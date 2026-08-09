import { describe, expect, test } from "bun:test";
import { EvidenceClaimInputSchema, EvidenceReviewInputSchema } from "./evidence-profile";

const id = "6b0c6f88-f8f0-4b58-9661-725b43f1847e";
describe("candidate evidence contracts", () => {
  test("requires provenance-ready claim values", () => expect(EvidenceClaimInputSchema.safeParse({ candidateId:id, claimType:"skill", label:"Skill", value:"PostgreSQL" }).success).toBe(true));
  test("requires a replacement for corrections", () => expect(EvidenceReviewInputSchema.safeParse({ candidateId:id, claimId:id, action:"correct", reason:"CV date typo" }).success).toBe(false));
  test("does not admit protected-attribute claim types", () => expect(EvidenceClaimInputSchema.safeParse({ candidateId:id, claimType:"gender", label:"Gender", value:"x" }).success).toBe(false));
});
