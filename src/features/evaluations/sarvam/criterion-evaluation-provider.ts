import 'server-only';
import {
  CriterionEvaluationOutputSchema,
  type CriterionEvaluationOutput,
} from '../schemas/evaluation';
import { providerEnabled } from '@/lib/providers/provider-controls';

type Criterion = { id: string; name: string; description: string; evidenceExpectations: string };
type Claim = { id: string; label: string; value: string; status: string; confidence: number };
export type EvaluationProviderResult = {
  data: CriterionEvaluationOutput;
  execution: {
    provider: 'sarvam' | 'fixture';
    model: string;
    promptVersion: 'criterion-evaluate.prompt.v1';
    schemaVersion: 'criterion-evaluation.v1';
    requestId?: string;
    latencyMs: number;
    status: 'succeeded' | 'simulated';
    error?: { code: string; message: string };
  };
};

export interface CriterionEvaluationProvider {
  evaluate(criteria: Criterion[], claims: Claim[]): Promise<EvaluationProviderResult>;
}

export class FakeCriterionEvaluationProvider implements CriterionEvaluationProvider {
  async evaluate(criteria: Criterion[], claims: Claim[]): Promise<EvaluationProviderResult> {
    const data = CriterionEvaluationOutputSchema.parse({
      schemaVersion: 'criterion-evaluation.v1',
      judgments: criteria.map((criterion) => {
        const terms = `${criterion.name} ${criterion.description} ${criterion.evidenceExpectations}`
          .toLowerCase()
          .split(/[^a-z0-9+#.]+/)
          .filter((term) => term.length > 3);
        const matches = claims.filter((claim) =>
          terms.some((term) => `${claim.label} ${claim.value}`.toLowerCase().includes(term)),
        );
        const confidence = matches.length
          ? Math.round(
              matches.reduce((sum, claim) => sum + claim.confidence * 100, 0) / matches.length,
            )
          : 0;
        const score = matches.length >= 2 ? 85 : matches.length === 1 ? 68 : 0;
        return {
          criterionId: criterion.id,
          rating: score >= 80 ? 'strong' : score >= 60 ? 'meets' : 'missing',
          score,
          confidence,
          reasoning: matches.length
            ? `Found ${matches.length} relevant evidence claim${matches.length === 1 ? '' : 's'}.`
            : 'No relevant evidence was found in the current profile snapshot.',
          evidenceClaimIds: matches.map((claim) => claim.id),
          gaps: matches.length ? [] : [`Evidence needed: ${criterion.evidenceExpectations}`],
        };
      }),
    });
    return {
      data,
      execution: {
        provider: 'fixture',
        model: 'deterministic-criterion-fixture-v1',
        promptVersion: 'criterion-evaluate.prompt.v1',
        schemaVersion: 'criterion-evaluation.v1',
        latencyMs: 0,
        status: 'simulated',
      },
    };
  }
}

export class SarvamCriterionEvaluationProvider implements CriterionEvaluationProvider {
  async evaluate(criteria: Criterion[], claims: Claim[]): Promise<EvaluationProviderResult> {
    const started = Date.now();
    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sarvam-105b',
        temperature: 0,
        max_tokens: 6000,
        messages: [
          {
            role: 'system',
            content:
              'Evaluate only supplied job-relevant evidence against each rubric criterion. Missing evidence lowers confidence and must not imply lack of capability. Ignore protected attributes and prestige proxies. Return JSON only with schemaVersion criterion-evaluation.v1 and judgments.',
          },
          { role: 'user', content: JSON.stringify({ criteria, claims }) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const body = (await response.json()) as {
      id?: string;
      choices?: { message?: { content?: string } }[];
      error?: { code?: string; message?: string };
    };
    if (!response.ok || !body.choices?.[0]?.message?.content)
      throw Object.assign(new Error(body.error?.message ?? 'Sarvam evaluation failed'), {
        code: body.error?.code ?? `http_${response.status}`,
      });
    return {
      data: CriterionEvaluationOutputSchema.parse(JSON.parse(body.choices[0].message.content)),
      execution: {
        provider: 'sarvam',
        model: 'sarvam-105b',
        promptVersion: 'criterion-evaluate.prompt.v1',
        schemaVersion: 'criterion-evaluation.v1',
        requestId: body.id,
        latencyMs: Date.now() - started,
        status: 'succeeded',
      },
    };
  }
}

export async function evaluateCriteria(criteria: Criterion[], claims: Claim[]) {
  if (!providerEnabled('sarvam'))
    return new FakeCriterionEvaluationProvider().evaluate(criteria, claims);
  try {
    return await new SarvamCriterionEvaluationProvider().evaluate(criteria, claims);
  } catch (error) {
    const fallback = await new FakeCriterionEvaluationProvider().evaluate(criteria, claims);
    return {
      ...fallback,
      execution: {
        ...fallback.execution,
        error: {
          code: String((error as { code?: string }).code ?? 'provider_error'),
          message: 'Sarvam evaluation was unavailable; deterministic simulated output was used.',
        },
      },
    };
  }
}
