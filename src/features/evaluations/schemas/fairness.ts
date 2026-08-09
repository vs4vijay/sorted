import { z } from 'zod';

export const AllowedMatchingInputs = [
  'Source-backed skills and certifications',
  'Relevant employment and project evidence',
  'Evidence-backed role scope and experience',
  'Job-related communication evidence',
] as const;
export const SeparateLogisticsInputs = [
  'Notice period and availability',
  'Current and expected compensation',
  'Work location, authorization, shifts, and travel',
] as const;
export const ProhibitedMatchingInputs = [
  'Age or date of birth',
  'Gender, sex, or name-based demographic inference',
  'Photograph or appearance',
  'Caste, religion, or marital status',
  'Disability or health information',
  'Employer or education prestige used as a silent quality proxy',
] as const;

const TimelineEntrySchema = z.object({
  kind: z.enum(['evaluation', 'review', 'decision', 'audit']),
  label: z.string(),
  actor: z.string().nullable(),
  detail: z.string(),
  occurredAt: z.coerce.date(),
});
export const FairnessCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  classification: z.string(),
  weight: z.coerce.number(),
  rating: z.string(),
  score: z.coerce.number(),
  evidenceConfidence: z.coerce.number(),
  reasoning: z.string(),
  evidenceClaimIds: z.array(z.string()),
  gaps: z.array(z.string()),
});
export const RecommendationReconstructionSchema = z.object({
  evaluation: z.object({
    id: z.string(),
    candidateId: z.string(),
    candidateName: z.string(),
    positionId: z.string(),
    positionTitle: z.string(),
    rubricId: z.string(),
    rubricVersion: z.coerce.number(),
    state: z.string(),
    roleFit: z.coerce.number().nullable(),
    evidenceConfidence: z.coerce.number().nullable(),
    recommendation: z.string().nullable(),
    createdAt: z.coerce.date(),
  }),
  provider: z
    .object({
      provider: z.string(),
      model: z.string(),
      promptVersion: z.string(),
      schemaVersion: z.string(),
      requestId: z.string().nullable(),
      latencyMs: z.coerce.number().nullable(),
      status: z.string(),
    })
    .nullable(),
  evidenceSnapshot: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      status: z.string(),
      confidence: z.coerce.number(),
      sourceId: z.string(),
      extractorVersion: z.string(),
    }),
  ),
  criteria: z.array(FairnessCriterionSchema),
  timeline: z.array(TimelineEntrySchema),
});
export type RecommendationReconstruction = z.infer<typeof RecommendationReconstructionSchema>;
