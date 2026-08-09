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
export const CreateSequenceInputSchema = z.object({
  threadId: z.string().uuid(),
  name: z.string().trim().min(3).max(100),
  delayBusinessDays: z.coerce.number().int().min(1).max(14),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(20).max(5000),
});
export const SequenceActionInputSchema = z.object({ enrollmentId: z.string().uuid(), threadId: z.string().uuid() });
export const RecruiterScreeningInputSchema = z.object({ threadId: z.string().uuid(), rationale: z.string().trim().min(20).max(1000) });

export const PipelineStageSchema = z.enum(["talent_pool","applied","under_review","needs_information","shortlisted","contacted","interested","recruiter_screening","not_advancing","withdrawn"]);

export function nextBusinessHour(from: Date, businessDays: number, timeZone = "Asia/Kolkata") {
  if (timeZone !== "Asia/Kolkata") throw new Error("Only the organization demo timezone is currently supported.");
  const value = new Date(from.getTime() + businessDays * 86_400_000);
  while ([0, 6].includes(value.getUTCDay())) value.setUTCDate(value.getUTCDate() + 1);
  value.setUTCHours(4, 30, 0, 0); // 10:00 India Standard Time
  return value;
}

export type OutreachDraftOutput = z.infer<typeof OutreachDraftOutputSchema>;
