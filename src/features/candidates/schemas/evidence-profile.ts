import { z } from "zod";

export const ClaimStatusSchema = z.enum([
  "explicit",
  "inferred",
  "externally_evidenced",
  "contradicted",
  "unverified",
]);

export const EvidenceClaimInputSchema = z.object({
  candidateId: z.string().uuid(),
  claimType: z.enum(["employment", "education", "project", "skill", "certification", "language", "logistics", "other"]),
  label: z.string().trim().min(2).max(160),
  value: z.string().trim().min(1).max(1000),
  status: ClaimStatusSchema.default("unverified"),
  sourceId: z.string().uuid().optional(),
  pageNumber: z.coerce.number().int().positive().optional(),
  section: z.string().trim().max(160).optional(),
  excerpt: z.string().trim().max(600).optional(),
  confidence: z.coerce.number().min(0).max(1).default(1),
});

export const EvidenceReviewInputSchema = z.object({
  candidateId: z.string().uuid(),
  claimId: z.string().uuid(),
  action: z.enum(["confirm", "reject", "correct"]),
  correctedValue: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(3).max(500),
}).superRefine((value, context) => {
  if (value.action === "correct" && !value.correctedValue) context.addIssue({ code: "custom", path: ["correctedValue"], message: "A corrected value is required." });
});

export type EvidenceClaimInput = z.infer<typeof EvidenceClaimInputSchema>;
export type EvidenceReviewInput = z.infer<typeof EvidenceReviewInputSchema>;
