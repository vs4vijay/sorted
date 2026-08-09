import { z } from 'zod';

export const PositionStatusSchema = z.enum(['draft', 'rubric_review', 'screening', 'paused']);
export const PipelineStageSchema = z.enum(['talent_pool', 'applied', 'under_review', 'shortlisted']);

export const PositionSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  employmentType: z.string(),
  status: PositionStatusSchema,
  candidateCount: z.number().int().nonnegative(),
  reviewedCount: z.number().int().nonnegative(),
  panel: z.array(z.object({ name: z.string(), initials: z.string(), role: z.string() })),
});

export const CandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  headline: z.string(),
  location: z.string(),
  experienceYears: z.number().nonnegative(),
  primarySkills: z.array(z.string()),
  profileCompleteness: z.number().min(0).max(100),
  evidenceConfidence: z.number().min(0).max(100),
  source: z.string(),
  stage: PipelineStageSchema,
  positionId: z.string().nullable(),
  roleFit: z.number().min(0).max(100).nullable(),
  lastActivity: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;

