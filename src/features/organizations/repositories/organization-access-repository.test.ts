import { describe, expect, test } from 'bun:test';
import { OrganizationAccessRepository } from './organization-access-repository';

describe('OrganizationAccessRepository', () => {
  test('resolves organization access only through the session membership join', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [{
        session_id: 'session-1', user_id: 'user-1', user_email: 'admin@acme.test', user_name: 'Asha Admin',
        organization_id: 'org-1', organization_name: 'Acme India', organization_slug: 'acme-india',
        organization_status: 'active', timezone: 'Asia/Kolkata', default_locale: 'en-IN', retention_days: 730,
        membership_id: 'member-1', membership_role: 'admin',
      }];
    });

    const access = await repository.findActiveAccessBySessionHash('hashed-token', 'acme-india');

    expect(capturedSql).toContain('organization_members.user_id = users.id');
    expect(capturedSql).toContain('organizations.id = organization_members.organization_id');
    expect(capturedSql).toContain('sessions.token_hash = $1');
    expect(capturedParams).toEqual(['hashed-token', 'acme-india']);
    expect(access?.organization.id).toBe('org-1');
    expect(access?.membership.role).toBe('admin');
  });

  test('does not trust a preferred organization without a matching membership', async () => {
    const repository = new OrganizationAccessRepository(async () => []);
    expect(await repository.findActiveAccessBySessionHash('hashed-token', 'other-org')).toBeNull();
  });
});
