import { z } from 'zod';

export const CriterionRatingSchema = z.enum([
  'strong',
  'meets',
  'partial',
  'missing',
  'contradicted',
]);
export const EvaluationRecommendationSchema = z.enum([
  'strong_review',
  'review',
  'needs_information',
  'low_match',
]);
export const EvaluationStateSchema = z.enum(['queued', 'evaluated', 'stale', 'failed']);

export const CriterionJudgmentSchema = z.object({
  criterionId: z.string().uuid(),
  rating: CriterionRatingSchema,
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().trim().min(1).max(1200),
  evidenceClaimIds: z.array(z.string().uuid()).max(30),
  gaps: z.array(z.string().trim().min(1).max(300)).max(10),
});

export const CriterionEvaluationOutputSchema = z.object({
  schemaVersion: z.literal('criterion-evaluation.v1'),
  judgments: z.array(CriterionJudgmentSchema).min(1),
});

export const MatchCandidateInputSchema = z.object({
  candidateId: z.string().uuid(),
  positionId: z.string().uuid(),
});

export type CriterionJudgment = z.infer<typeof CriterionJudgmentSchema>;
export type CriterionEvaluationOutput = z.infer<typeof CriterionEvaluationOutputSchema>;

export function validateCriterionCoverage(criterionIds: string[], judgments: CriterionJudgment[]) {
  const expected = new Set(criterionIds),
    received = new Set(judgments.map((judgment) => judgment.criterionId));
  if (
    received.size !== judgments.length ||
    expected.size !== received.size ||
    [...expected].some((id) => !received.has(id))
  )
    throw new Error('Provider judgments must cover each rubric criterion exactly once.');
  return judgments;
}

export function calculateEvaluation(
  criteria: Array<{ id: string; weight: number; classification: string }>,
  judgments: CriterionJudgment[],
) {
  const scored = criteria.filter((criterion) => criterion.classification !== 'informational');
  const byId = new Map(judgments.map((judgment) => [judgment.criterionId, judgment]));
  const weight = scored.reduce((total, criterion) => total + criterion.weight, 0);
  const roleFit = weight
    ? Math.round(
        scored.reduce(
          (total, criterion) => total + (byId.get(criterion.id)?.score ?? 0) * criterion.weight,
          0,
        ) / weight,
      )
    : 0;
  const evidenceConfidence = criteria.length
    ? Math.round(
        criteria.reduce(
          (total, criterion) => total + (byId.get(criterion.id)?.confidence ?? 0),
          0,
        ) / criteria.length,
      )
    : 0;
  const recommendation =
    evidenceConfidence < 45
      ? 'needs_information'
      : roleFit >= 80
        ? 'strong_review'
        : roleFit >= 60
          ? 'review'
          : 'low_match';
  return {
    roleFit,
    evidenceConfidence,
    recommendation: EvaluationRecommendationSchema.parse(recommendation),
  };
}
