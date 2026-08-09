import { describe, expect, test } from 'bun:test';
import { DraftMessageInputSchema, OutreachDraftOutputSchema } from './outreach';
describe('outreach contracts', () => {
  test('requires a bounded approved information request', () => {
    expect(
      DraftMessageInputSchema.safeParse({
        shortlistDecisionId: crypto.randomUUID(),
        purpose: 'missing_information',
        requestedFields: ['notice_period', 'expected_ctc'],
      }).success,
    ).toBe(true);
    expect(
      DraftMessageInputSchema.safeParse({
        shortlistDecisionId: crypto.randomUUID(),
        purpose: 'missing_information',
        requestedFields: [],
      }).success,
    ).toBe(false);
  });
  test('rejects unsupported generated fields', () => {
    expect(
      OutreachDraftOutputSchema.safeParse({
        schemaVersion: 'outreach-draft.v1',
        subject: 'Next step',
        body: 'Please share the information requested so our recruiting team can review it.',
        requestedFields: ['salary_offer'],
      }).success,
    ).toBe(false);
  });
});
