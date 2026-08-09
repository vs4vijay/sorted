import 'server-only';
import { StructuredJobDescriptionSchemaV1, type StructuredJobDescription } from '../schemas/position';

export type StructuringResult = { data: StructuredJobDescription; execution: { provider: 'sarvam' | 'fixture'; model: string; promptVersion: 'jd-structure.prompt.v1'; schemaVersion: 'jd-structure.v1'; requestId?: string; latencyMs: number; status: 'succeeded' | 'simulated'; error?: { code: string; message: string } } };
export interface JobDescriptionStructuringProvider { structure(text: string, titleHint: string): Promise<StructuringResult>; }

export class FakeJobDescriptionStructuringProvider implements JobDescriptionStructuringProvider {
  async structure(text: string, titleHint: string): Promise<StructuringResult> {
    const backend = /backend|api|distributed|postgres|kafka/i.test(text);
    return { data: StructuredJobDescriptionSchemaV1.parse({ schemaVersion: 'jd-structure.v1', title: titleHint, seniority: /senior|lead/i.test(`${titleHint} ${text}`) ? 'Senior' : 'Not specified', responsibilities: backend ? ['Design reliable backend services', 'Own production quality and delivery'] : ['Deliver the role responsibilities described in the job description'], skills: backend ? ['Backend architecture', 'PostgreSQL', 'Distributed systems'] : ['Role-specific expertise'], minimumExperience: null, preferredExperience: null, logistics: [], criteria: backend ? [
      { name: 'Backend architecture', description: 'Designs maintainable production services.', criterionType: 'technical', classification: 'must_have', weight: 40, evidenceExpectations: 'Specific systems designed and production outcomes.' },
      { name: 'Data and distributed systems', description: 'Works effectively with PostgreSQL and distributed components.', criterionType: 'technical', classification: 'must_have', weight: 35, evidenceExpectations: 'Projects showing database or distributed-systems depth.' },
      { name: 'Technical ownership', description: 'Owns delivery and operational quality.', criterionType: 'experience', classification: 'preferred', weight: 25, evidenceExpectations: 'Examples of ownership, reliability, or mentoring.' },
      { name: 'Notice period', description: 'Capture availability without affecting merit.', criterionType: 'logistics', classification: 'informational', weight: 0, evidenceExpectations: 'Candidate-confirmed notice period.' },
    ] : [{ name: 'Relevant experience', description: 'Demonstrates relevant role experience.', criterionType: 'experience', classification: 'must_have', weight: 100, evidenceExpectations: 'Specific, attributable work evidence.' }] }), execution: { provider: 'fixture', model: 'deterministic-jd-fixture-v1', promptVersion: 'jd-structure.prompt.v1', schemaVersion: 'jd-structure.v1', latencyMs: 0, status: 'simulated' } };
  }
}

export class SarvamJobDescriptionStructuringProvider implements JobDescriptionStructuringProvider {
  async structure(text: string, titleHint: string): Promise<StructuringResult> {
    const started = Date.now();
    const response = await fetch('https://api.sarvam.ai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', 'api-subscription-key': process.env.SARVAM_API_KEY! }, body: JSON.stringify({ model: 'sarvam-105b', temperature: 0.1, max_tokens: 4000, messages: [{ role: 'system', content: 'Structure this Indian hiring job description. Use only job-relevant evidence; never infer protected attributes. Scored weights excluding informational criteria must total 100.' }, { role: 'user', content: `Title hint: ${titleHint}\n\n${text}` }], response_format: { type: 'json_schema', json_schema: { name: 'sorted_jd_structure_v1', strict: true, schema: { type: 'object', additionalProperties: false, required: ['schemaVersion','title','seniority','responsibilities','skills','minimumExperience','preferredExperience','logistics','criteria'], properties: { schemaVersion: { const: 'jd-structure.v1' }, title: { type: 'string' }, seniority: { type: 'string' }, responsibilities: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } }, minimumExperience: { type: ['integer','null'] }, preferredExperience: { type: ['integer','null'] }, logistics: { type: 'array', items: { type: 'string' } }, criteria: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name','description','criterionType','classification','weight','evidenceExpectations'], properties: { name: { type: 'string' }, description: { type: 'string' }, criterionType: { type: 'string' }, classification: { enum: ['must_have','preferred','logistics','informational'] }, weight: { type: 'integer' }, evidenceExpectations: { type: 'string' } } } } } } } } }) });
    const body = await response.json() as { id?: string; choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } };
    if (!response.ok || !body.choices?.[0]?.message?.content) throw Object.assign(new Error(body.error?.message ?? `Sarvam request failed (${response.status})`), { code: body.error?.code ?? `http_${response.status}`, requestId: body.id, latencyMs: Date.now() - started });
    return { data: StructuredJobDescriptionSchemaV1.parse(JSON.parse(body.choices[0].message.content)), execution: { provider: 'sarvam', model: 'sarvam-105b', promptVersion: 'jd-structure.prompt.v1', schemaVersion: 'jd-structure.v1', requestId: body.id, latencyMs: Date.now() - started, status: 'succeeded' } };
  }
}

export async function structureJobDescription(text: string, title: string): Promise<StructuringResult> {
  if (!text) return new FakeJobDescriptionStructuringProvider().structure('', title);
  if (!process.env.SARVAM_API_KEY) return new FakeJobDescriptionStructuringProvider().structure(text, title);
  try { return await new SarvamJobDescriptionStructuringProvider().structure(text, title); }
  catch (error) { const fallback = await new FakeJobDescriptionStructuringProvider().structure(text, title); return { ...fallback, execution: { ...fallback.execution, error: { code: String((error as { code?: string }).code ?? 'provider_error'), message: 'Sarvam structuring was unavailable; deterministic simulated output was used.' } } }; }
}
