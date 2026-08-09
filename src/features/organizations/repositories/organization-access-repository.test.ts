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

  test('scopes member lists to the resolved organization', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [{ id: 'member-1', name: 'Asha Admin', email: 'asha@acme.test', role: 'admin', joined_at: new Date('2026-08-09'), is_current_user: true }];
    });
    const members = await repository.listMembers('org-1', 'user-1');
    expect(capturedSql).toContain('organization_members.organization_id = $1');
    expect(capturedParams).toEqual(['org-1', 'user-1']);
    expect(members[0].isCurrentUser).toBe(true);
  });

  test('creates an invitation and audit event in one statement', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [{ created: true }];
    });
    expect(await repository.createInvitation({ id: 'invite-1', organizationId: 'org-1', email: 'reviewer@acme.test', role: 'technical_reviewer', tokenHash: 'hash', invitedById: 'user-1', expiresAt: new Date('2026-08-16'), auditEventId: 'audit-1' })).toBe(true);
    expect(capturedSql).toContain('invitation.created');
    expect(capturedSql).toContain('INSERT INTO audit_events');
    expect(capturedParams[1]).toBe('org-1');
  });

  test('role changes require both membership and organization identifiers', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [{ changed: true }];
    });
    expect(await repository.updateMemberRole({ organizationId: 'org-1', membershipId: 'member-2', actorUserId: 'user-1', role: 'hiring_manager', auditEventId: 'audit-1' })).toBe(true);
    expect(capturedSql).toContain('id = $1 AND organization_id = $2');
    expect(capturedParams.slice(0, 2)).toEqual(['member-2', 'org-1']);
  });

  test('revokes only a pending invitation in the resolved organization and audits it', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql; capturedParams = params ?? []; return [{ revoked: true }];
    });
    expect(await repository.revokeInvitation({ invitationId: 'invite-1', organizationId: 'org-1', actorUserId: 'user-1', auditEventId: 'audit-1' })).toBe(true);
    expect(capturedSql).toContain("organization_id = $2 AND status = 'pending'");
    expect(capturedSql).toContain('invitation.revoked');
    expect(capturedParams.slice(0, 3)).toEqual(['invite-1', 'org-1', 'user-1']);
  });

  test('accepts an invitation atomically without trusting browser organization input', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql; capturedParams = params ?? []; return [{ organization_slug: 'acme-india' }];
    });
    const accepted = await repository.acceptInvitation({ tokenHash: 'token-hash', name: 'Ravi Reviewer', passwordHash: 'argon-hash', userId: 'user-2',
      membershipId: 'member-2', sessionId: 'session-2', sessionTokenHash: 'session-hash',
      sessionExpiresAt: new Date('2026-08-23'), auditEventId: 'audit-2' });
    expect(accepted).toEqual({ organizationSlug: 'acme-india' });
    expect(capturedSql).toContain('invitations.token_hash = $1');
    expect(capturedSql).toContain('invitation.accepted');
    expect(capturedSql).toContain('ON CONFLICT (organization_id, user_id) DO NOTHING');
    expect(capturedParams).not.toContain('org-1');
  });

  test('checks email and slug collisions in one setup preflight query', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [{ email_taken: true, slug_taken: false }];
    });
    expect(await repository.findSetupConflicts('admin@acme.test', 'acme-india')).toEqual({
      emailTaken: true,
      slugTaken: false,
    });
    expect(capturedSql).toContain('EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))');
    expect(capturedSql).toContain('EXISTS(SELECT 1 FROM organizations WHERE slug = $2)');
    expect(capturedParams).toEqual(['admin@acme.test', 'acme-india']);
  });

  test('creates the first organization and session in one statement', async () => {
    let capturedSql = '';
    let capturedParams: unknown[] = [];
    const repository = new OrganizationAccessRepository(async (sql, params) => {
      capturedSql = sql;
      capturedParams = params ?? [];
      return [];
    });
    await repository.createFirstOrganizationWithSession({
      userId: 'user-1',
      name: 'Asha Admin',
      email: 'asha@acme.test',
      passwordHash: 'hash',
      organizationId: 'org-1',
      organizationName: 'Acme India',
      organizationSlug: 'acme-india',
      membershipId: 'member-1',
      auditEventId: 'audit-1',
      timezone: 'Asia/Kolkata',
      defaultLocale: 'en-IN',
      sessionId: 'session-1',
      sessionTokenHash: 'session-hash',
      sessionExpiresAt: new Date('2026-08-23'),
    });
    expect(capturedSql).toContain('INSERT INTO users');
    expect(capturedSql).toContain('INSERT INTO organizations');
    expect(capturedSql).toContain('INSERT INTO organization_members');
    expect(capturedSql).toContain('INSERT INTO audit_events');
    expect(capturedSql).toContain('INSERT INTO sessions');
    expect(capturedParams).toContain('session-1');
    expect(capturedParams).toContain('session-hash');
  });
});
