import { z } from "zod";

export const ReviewStateSchema = z.enum(["not_started", "in_review", "submitted", "changes_requested"]);
export const ReviewerRecommendationSchema = z.enum(["shortlist", "hold", "needs_information", "do_not_advance"]);
export const ShortlistDecisionValueSchema = z.enum(["shortlisted", "hold", "not_advancing"]);
export const AssignReviewerInputSchema = z.object({ evaluationId: z.string().uuid(), reviewerMemberId: z.string().uuid() });
export const SubmitReviewInputSchema = z.object({
  assignmentId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  recommendation: ReviewerRecommendationSchema,
  summary: z.string().trim().min(10).max(2000),
});
export const ReviewCommentInputSchema = z.object({ evaluationId: z.string().uuid(), criterionId: z.string().uuid().optional(), body: z.string().trim().min(2).max(1200) });
export const ShortlistDecisionInputSchema = z.object({ evaluationId: z.string().uuid(), decision: ShortlistDecisionValueSchema, rationale: z.string().trim().min(10).max(2000) });

export function hasReviewDisagreement(recommendations: string[]) { return new Set(recommendations).size > 1; }
export function decisionOverridesConsensus(decision: string, recommendations: string[]) {
  if (!recommendations.length || hasReviewDisagreement(recommendations)) return true;
  const expected = recommendations[0] === "shortlist" ? "shortlisted" : recommendations[0] === "do_not_advance" ? "not_advancing" : "hold";
  return decision !== expected;
}
