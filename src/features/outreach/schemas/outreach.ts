import { z } from "zod";

export const OutreachPurposeSchema = z.enum(["missing_information", "shortlist_interest"]);
export const RequestedFieldSchema = z.enum(["notice_period", "expected_ctc", "interest"]);
export const DraftMessageInputSchema = z.object({
  shortlistDecisionId: z.string().uuid(),
  purpose: OutreachPurposeSchema,
  requestedFields: z.array(RequestedFieldSchema).min(1).max(3),
});
export const OutreachDraftOutputSchema = z.object({
  schemaVersion: z.literal("outreach-draft.v1"),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(20).max(5000),
  requestedFields: z.array(RequestedFieldSchema).min(1).max(3),
});
export const EditDraftInputSchema = z.object({ messageId: z.string().uuid(), subject: z.string().trim().min(3).max(160), body: z.string().trim().min(20).max(5000) });
export const MessageActionInputSchema = z.object({ messageId: z.string().uuid() });
export const CandidateResponseInputSchema = z.object({ threadId: z.string().uuid(), body: z.string().trim().min(2).max(5000), eventType: z.enum(["reply", "bounce", "opt_out"]).default("reply") });
export const ConfirmSuggestionInputSchema = z.object({ responseId: z.string().uuid(), field: RequestedFieldSchema, value: z.string().trim().min(1).max(200) });

export type OutreachDraftOutput = z.infer<typeof OutreachDraftOutputSchema>;
