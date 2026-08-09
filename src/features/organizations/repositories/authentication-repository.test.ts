import { describe, expect, test } from 'bun:test';
import { AuthenticationRepository } from './authentication-repository';

describe('AuthenticationRepository', () => {
  test('sign-in resolves an active organization through membership', async () => {
    let sql = ''; let params: unknown[] = [];
    const repository = new AuthenticationRepository(async (statement, values) => { sql = statement; params = values ?? []; return [{ id: 'user-1', password_hash: 'hash', organization_slug: 'acme-india' }]; });
    expect(await repository.findUserForSignIn('admin@acme.test')).toEqual({ id: 'user-1', passwordHash: 'hash', organizationSlug: 'acme-india' });
    expect(sql).toContain('organization_members.user_id = users.id'); expect(sql).toContain("organizations.status = 'active'"); expect(params).toEqual(['admin@acme.test']);
  });
});
