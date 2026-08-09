import { describe, expect, test } from 'bun:test';
import {
  ShortlistDecisionInputSchema,
  SubmitReviewInputSchema,
  decisionOverridesConsensus,
  hasReviewDisagreement,
} from './panel-review';

describe('panel review rules', () => {
  test('keeps conflicting recommendations visible', () =>
    expect(hasReviewDisagreement(['shortlist', 'hold'])).toBe(true));
  test('detects a decision that overrides unanimous reviewer consensus', () =>
    expect(decisionOverridesConsensus('shortlisted', ['hold', 'hold'])).toBe(true));
  test('requires human narrative for reviews and decisions', () => {
    expect(
      SubmitReviewInputSchema.safeParse({
        assignmentId: crypto.randomUUID(),
        evaluationId: crypto.randomUUID(),
        recommendation: 'shortlist',
        summary: 'too short',
      }).success,
    ).toBe(false);
    expect(
      ShortlistDecisionInputSchema.safeParse({
        evaluationId: crypto.randomUUID(),
        decision: 'shortlisted',
        rationale: '',
      }).success,
    ).toBe(false);
  });
  test('does not accept AI recommendations as final decisions', () =>
    expect(
      ShortlistDecisionInputSchema.safeParse({
        evaluationId: crypto.randomUUID(),
        decision: 'strong_review',
        rationale: 'Human rationale is recorded here.',
      }).success,
    ).toBe(false));
});
