import { describe, expect, test } from "bun:test";
import { CreateSequenceInputSchema, RecruiterScreeningInputSchema, nextBusinessHour } from "./outreach";

describe("safe outreach sequences", () => {
  test("requires a bounded, approved-template-shaped step", () => {
    expect(CreateSequenceInputSchema.safeParse({ threadId: crypto.randomUUID(), name: "Interest reminder", delayBusinessDays: 2, subject: "Checking in", body: "Just checking whether you remain interested in this role." }).success).toBe(true);
    expect(CreateSequenceInputSchema.safeParse({ threadId: crypto.randomUUID(), name: "x", delayBusinessDays: 0, subject: "x", body: "send" }).success).toBe(false);
  });
  test("moves weekend reminders to the next business morning", () => {
    expect(nextBusinessHour(new Date("2026-08-07T12:00:00Z"), 1).toISOString()).toBe("2026-08-10T04:30:00.000Z");
  });
  test("requires a human rationale for recruiter screening", () => {
    expect(RecruiterScreeningInputSchema.safeParse({ threadId: crypto.randomUUID(), rationale: "Candidate replied with interest and confirmed logistics." }).success).toBe(true);
    expect(RecruiterScreeningInputSchema.safeParse({ threadId: crypto.randomUUID(), rationale: "AI said yes" }).success).toBe(false);
  });
});
