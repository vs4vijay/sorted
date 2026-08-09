import { describe, expect, test } from 'bun:test';
import { OrganizationAccessRepository } from './organization-access-repository';
describe('session lifecycle SQL', () => {
  test('creates opaque hashed sessions and revokes by server-resolved id', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => { calls.push({ sql, params: params ?? [] }); return []; });
    const expiresAt = new Date('2026-08-23T00:00:00Z');
    await repository.createSession({ id: 'session-1', userId: 'user-1', tokenHash: 'hash', expiresAt });
    await repository.revokeSession('session-1');
    expect(calls[0].sql).toContain('token_hash');
    expect(calls[0].params).toEqual(['session-1', 'user-1', 'hash', expiresAt]);
    expect(calls[1].sql).toContain('revoked_at = CURRENT_TIMESTAMP');
    expect(calls[1].params).toEqual(['session-1']);
  });
});
