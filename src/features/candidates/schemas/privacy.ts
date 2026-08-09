import { z } from "zod";

export const CandidatePrivacyRequestTypeSchema = z.enum(["correction", "export", "deletion"]);
export const CandidatePrivacyRequestStatusSchema = z.enum(["requested", "approved", "completed", "declined"]);
export const CandidatePrivacyRequestInputSchema = z.object({
  candidateId: z.string().uuid(),
  requestType: CandidatePrivacyRequestTypeSchema,
  details: z.string().trim().min(10).max(1000),
});
export const CandidatePrivacyDecisionInputSchema = z.object({
  candidateId: z.string().uuid(),
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "decline"]),
  rationale: z.string().trim().min(10).max(1000),
});

export type CandidatePrivacyRequestInput = z.infer<typeof CandidatePrivacyRequestInputSchema>;
export type CandidatePrivacyDecisionInput = z.infer<typeof CandidatePrivacyDecisionInputSchema>;
