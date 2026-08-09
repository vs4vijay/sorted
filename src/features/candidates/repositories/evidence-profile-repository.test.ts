import { describe, expect, test } from 'bun:test';
import { EvidenceProfileRepository } from './evidence-profile-repository';
describe('evidence repository isolation', () => {
  test('scopes profile queries by organization and candidate', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new EvidenceProfileRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [];
    });
    await repo.getProfile('org-a', 'candidate-a');
    expect(calls[0].sql).toContain('organization_id=$1');
    expect(calls[0].params).toEqual(['org-a', 'candidate-a']);
  });
  test('checks claim ownership before appending a review', async () => {
    let count = 0;
    const repo = new EvidenceProfileRepository(async () => {
      count++;
      return [];
    });
    await expect(
      repo.reviewClaim('org-a', 'actor', {
        candidateId: '6b0c6f88-f8f0-4b58-9661-725b43f1847e',
        claimId: '6b0c6f88-f8f0-4b58-9661-725b43f1847e',
        action: 'confirm',
        reason: 'Checked against source',
      }),
    ).rejects.toThrow();
    expect(count).toBe(1);
  });
});
