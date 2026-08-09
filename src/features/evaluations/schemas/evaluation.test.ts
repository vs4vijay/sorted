import { describe, expect, test } from 'bun:test';
import {
  CriterionEvaluationOutputSchema,
  calculateEvaluation,
  validateCriterionCoverage,
} from './evaluation';
const ids = [crypto.randomUUID(), crypto.randomUUID()];
describe('position evaluation rules', () => {
  test('keeps role fit and evidence confidence separate and excludes informational weight', () => {
    const judgments = [
      {
        criterionId: ids[0],
        rating: 'strong' as const,
        score: 90,
        confidence: 80,
        reasoning: 'Supported',
        evidenceClaimIds: [],
        gaps: [],
      },
      {
        criterionId: ids[1],
        rating: 'missing' as const,
        score: 0,
        confidence: 0,
        reasoning: 'Missing',
        evidenceClaimIds: [],
        gaps: ['Candidate confirmation needed'],
      },
    ];
    expect(
      calculateEvaluation(
        [
          { id: ids[0], weight: 100, classification: 'must_have' },
          { id: ids[1], weight: 0, classification: 'informational' },
        ],
        judgments,
      ),
    ).toEqual({ roleFit: 90, evidenceConfidence: 40, recommendation: 'needs_information' });
  });
  test('schema rejects an auto-reject rating', () => {
    expect(
      CriterionEvaluationOutputSchema.safeParse({
        schemaVersion: 'criterion-evaluation.v1',
        judgments: [
          {
            criterionId: ids[0],
            rating: 'auto_reject',
            score: 0,
            confidence: 0,
            reasoning: 'No',
            evidenceClaimIds: [],
            gaps: [],
          },
        ],
      }).success,
    ).toBe(false);
  });
  test('provider output must cover every criterion exactly once', () => {
    const judgment = {
      criterionId: ids[0],
      rating: 'meets' as const,
      score: 70,
      confidence: 60,
      reasoning: 'Evidence',
      evidenceClaimIds: [],
      gaps: [],
    };
    expect(() => validateCriterionCoverage(ids, [judgment])).toThrow();
    expect(() => validateCriterionCoverage([ids[0]], [judgment, judgment])).toThrow();
  });
});
