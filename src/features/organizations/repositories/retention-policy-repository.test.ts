import { describe, expect, test } from 'bun:test';
import { RetentionPolicyRepository } from './retention-policy-repository';
describe('retention policy repository', () => {
  test('scopes and audits policy updates', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new RetentionPolicyRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [{ subject_id: 'org-a' }];
    });
    await repo.update('org-a', 'user-a', 365);
    expect(calls[0].params?.slice(0, 2)).toEqual([365, 'org-a']);
    expect(calls[0].sql).toContain('retention_policy_updated');
  });
  test('creates human-review requests idempotently', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new RetentionPolicyRepository(async (sql, params) => {
      calls.push({ sql, params });
      return sql.startsWith('SELECT retention_days')
        ? [{ retention_days: 180 }]
        : [{ subject_id: 'request-a' }];
    });
    expect(await repo.enforce('org-a', 'user-a')).toBe(1);
    expect(calls[1].sql).toContain("status IN ('requested','approved')");
    expect(calls[1].params).toEqual(['org-a', 180, 'user-a']);
  });
});
