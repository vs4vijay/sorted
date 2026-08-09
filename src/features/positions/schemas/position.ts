import { z } from 'zod';

export const CriterionClassificationSchema = z.enum([
  'must_have',
  'preferred',
  'logistics',
  'informational',
]);
export const StructuredCriterionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  criterionType: z.string().trim().min(2).max(80),
  classification: CriterionClassificationSchema,
  weight: z.number().int().min(0).max(100),
  evidenceExpectations: z.string().trim().min(2).max(500),
});
export const StructuredJobDescriptionSchemaV1 = z
  .object({
    schemaVersion: z.literal('jd-structure.v1'),
    title: z.string().trim().min(2).max(160),
    seniority: z.string().trim().max(80),
    responsibilities: z.array(z.string().trim().min(2)).max(12),
    skills: z.array(z.string().trim().min(1)).max(20),
    minimumExperience: z.number().int().min(0).max(50).nullable(),
    preferredExperience: z.number().int().min(0).max(50).nullable(),
    logistics: z.array(z.string().trim().min(2)).max(10),
    criteria: z.array(StructuredCriterionSchema).min(1).max(16),
  })
  .superRefine((value, context) => {
    const scored = value.criteria.filter((item) => item.classification !== 'informational');
    const total = scored.reduce((sum, item) => sum + item.weight, 0);
    if (total !== 100)
      context.addIssue({
        code: 'custom',
        path: ['criteria'],
        message: 'Scored criterion weights must total 100.',
      });
  });

export const CreatePositionSchema = z.object({
  title: z.string().trim().min(2).max(160),
  employmentType: z.string().trim().min(2).max(60),
  location: z.string().trim().max(120).optional().default(''),
  workplacePreference: z.string().trim().max(60).optional().default(''),
  jobDescription: z.string().trim().max(30000).optional().default(''),
});
export type StructuredJobDescription = z.infer<typeof StructuredJobDescriptionSchemaV1>;
