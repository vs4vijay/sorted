import { afterEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { OrganizationAccessRepository } from './organization-access-repository';

async function createAccessSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email));

    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      default_locale TEXT NOT NULL DEFAULT 'en-IN',
      retention_days INTEGER NOT NULL DEFAULT 730,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, user_id)
    );

    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    );
  `);
}

function repositoryFor(db: PGlite) {
  return new OrganizationAccessRepository(async (sql, params = []) => {
    const result = await db.query(sql, params as never[]);
    return result.rows as Record<string, unknown>[];
  });
}

function baseInput(overrides: Partial<Parameters<OrganizationAccessRepository['createFirstOrganizationWithSession']>[0]> = {}) {
  return {
    userId: randomUUID(),
    name: 'Asha Admin',
    email: 'asha@acme.test',
    passwordHash: 'hash',
    organizationId: randomUUID(),
    organizationName: 'Acme India',
    organizationSlug: 'acme-india',
    membershipId: randomUUID(),
    auditEventId: randomUUID(),
    timezone: 'Asia/Kolkata',
    defaultLocale: 'en-IN',
    sessionId: randomUUID(),
    sessionTokenHash: 'session-hash',
    sessionExpiresAt: new Date('2026-08-23T00:00:00Z'),
    ...overrides,
  };
}

describe('OrganizationAccessRepository PGlite integration', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    if (db) {
      await db.close();
      db = undefined;
    }
  });

  test('creates user, org, membership, audit, and session in one statement', async () => {
    db = new PGlite();
    await db.waitReady;
    await createAccessSchema(db);
    const repository = repositoryFor(db);
    const input = baseInput();

    await repository.createFirstOrganizationWithSession(input);

    const counts = await db.query<{
      users: number;
      organizations: number;
      organization_members: number;
      audit_events: number;
      sessions: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM organizations) AS organizations,
        (SELECT COUNT(*)::int FROM organization_members) AS organization_members,
        (SELECT COUNT(*)::int FROM audit_events) AS audit_events,
        (SELECT COUNT(*)::int FROM sessions) AS sessions
    `);
    expect(counts.rows[0]).toEqual({
      users: 1,
      organizations: 1,
      organization_members: 1,
      audit_events: 1,
      sessions: 1,
    });

    const user = await db.query<{ email: string }>('SELECT email FROM users');
    expect(user.rows[0]?.email).toBe('asha@acme.test');
  });

  test('rolls back earlier inserts when the session insert fails', async () => {
    db = new PGlite();
    await db.waitReady;
    await createAccessSchema(db);
    const repository = repositoryFor(db);

    await expect(
      repository.createFirstOrganizationWithSession(
        baseInput({ sessionTokenHash: null as unknown as string }),
      ),
    ).rejects.toThrow();

    const counts = await db.query<{
      users: number;
      organizations: number;
      organization_members: number;
      audit_events: number;
      sessions: number;
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM organizations) AS organizations,
        (SELECT COUNT(*)::int FROM organization_members) AS organization_members,
        (SELECT COUNT(*)::int FROM audit_events) AS audit_events,
        (SELECT COUNT(*)::int FROM sessions) AS sessions
    `);
    expect(counts.rows[0]).toEqual({
      users: 0,
      organizations: 0,
      organization_members: 0,
      audit_events: 0,
      sessions: 0,
    });
  });

  test('rejects duplicate emails case-insensitively via the LOWER(email) unique index', async () => {
    db = new PGlite();
    await db.waitReady;
    await createAccessSchema(db);
    const repository = repositoryFor(db);

    await repository.createFirstOrganizationWithSession(baseInput({ email: 'User@Company.com' }));

    await expect(
      repository.createFirstOrganizationWithSession(
        baseInput({
          email: 'user@company.com',
          organizationSlug: 'other-org',
          userId: randomUUID(),
          organizationId: randomUUID(),
          membershipId: randomUUID(),
          auditEventId: randomUUID(),
          sessionId: randomUUID(),
          sessionTokenHash: 'session-hash-2',
        }),
      ),
    ).rejects.toThrow(/users_email_lower_key|unique|duplicate/i);

    const users = await db.query<{ email: string }>('SELECT email FROM users');
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]?.email).toBe('user@company.com');
  });

  test('rejects duplicate organization slugs', async () => {
    db = new PGlite();
    await db.waitReady;
    await createAccessSchema(db);
    const repository = repositoryFor(db);

    await repository.createFirstOrganizationWithSession(baseInput());

    await expect(
      repository.createFirstOrganizationWithSession(
        baseInput({
          email: 'other@acme.test',
          userId: randomUUID(),
          organizationId: randomUUID(),
          membershipId: randomUUID(),
          auditEventId: randomUUID(),
          sessionId: randomUUID(),
          sessionTokenHash: 'session-hash-2',
        }),
      ),
    ).rejects.toThrow(/organizations_slug|unique|duplicate/i);

    const orgs = await db.query('SELECT id FROM organizations');
    expect(orgs.rows).toHaveLength(1);
  });
});
