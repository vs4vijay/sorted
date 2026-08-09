import { describe, expect, test } from 'bun:test';
import { EvidenceClaimInputSchema } from '@/features/candidates/schemas/evidence-profile';
import { CandidateExtractionSchemaV1 } from '@/features/candidates/schemas/ingestion';
import {
  AllowedMatchingInputs,
  ProhibitedMatchingInputs,
  RecommendationReconstructionSchema,
} from './fairness';

describe('fairness inspection contracts', () => {
  test('publishes distinct allowed and prohibited matching inputs', () => {
    expect(AllowedMatchingInputs.length).toBeGreaterThan(0);
    expect(ProhibitedMatchingInputs.join(' ').toLowerCase()).toContain('caste');
    expect(ProhibitedMatchingInputs.join(' ').toLowerCase()).toContain('gender');
  });
  test('protected attributes cannot enter extraction or evidence contracts', () => {
    expect(
      EvidenceClaimInputSchema.safeParse({
        candidateId: crypto.randomUUID(),
        claimType: 'gender',
        label: 'Gender',
        value: 'female',
        reason: 'test',
      }).success,
    ).toBeFalse();
    const extracted = {
      schemaVersion: 'candidate-extraction.v1',
      displayName: 'Synthetic Candidate',
      headline: 'Engineer',
      location: null,
      emails: [],
      phones: [],
      externalProfiles: [],
      identityHints: [],
      processingWarnings: [],
      gender: 'female',
    };
    const parsed = CandidateExtractionSchemaV1.parse(extracted);
    expect('gender' in parsed).toBeFalse();
  });
  test('rejects an unversioned provider reconstruction', () =>
    expect(
      RecommendationReconstructionSchema.safeParse({
        evaluation: {},
        provider: { provider: 'sarvam' },
        evidenceSnapshot: [],
        criteria: [],
        timeline: [],
      }).success,
    ).toBeFalse());
});
