import { executeQuery } from '@/lib/db';
import {
  ResolvedOrganizationAccessSchema,
  type ResolvedOrganizationAccess,
} from '../schemas/access';

type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

type AccessRow = {
  session_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  organization_status: 'active' | 'suspended' | 'archived';
  timezone: string;
  default_locale: string;
  retention_days: number;
  membership_id: string;
  membership_role: 'admin' | 'recruiter' | 'hiring_manager' | 'technical_reviewer';
};

export class OrganizationAccessRepository {
  constructor(private readonly query: Query = executeQuery) {}

  async findActiveAccessBySessionHash(
    sessionTokenHash: string,
    preferredOrganizationSlug?: string,
  ): Promise<ResolvedOrganizationAccess | null> {
    const rows = await this.query(
      `SELECT
        sessions.id AS session_id,
        users.id AS user_id,
        users.email AS user_email,
        users.name AS user_name,
        organizations.id AS organization_id,
        organizations.name AS organization_name,
        organizations.slug AS organization_slug,
        organizations.status AS organization_status,
        organizations.timezone,
        organizations.default_locale,
        organizations.retention_days,
        organization_members.id AS membership_id,
        organization_members.role AS membership_role
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      INNER JOIN organization_members ON organization_members.user_id = users.id
      INNER JOIN organizations ON organizations.id = organization_members.organization_id
      WHERE sessions.token_hash = $1
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > CURRENT_TIMESTAMP
        AND organizations.status = 'active'
        AND ($2::TEXT IS NULL OR organizations.slug = $2)
      ORDER BY organization_members.created_at ASC
      LIMIT 1`,
      [sessionTokenHash, preferredOrganizationSlug ?? null],
    ) as AccessRow[];

    const row = rows[0];
    if (!row) return null;

    return ResolvedOrganizationAccessSchema.parse({
      sessionId: row.session_id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      organization: {
        id: row.organization_id,
        name: row.organization_name,
        slug: row.organization_slug,
        status: row.organization_status,
        timezone: row.timezone,
        defaultLocale: row.default_locale,
        retentionDays: row.retention_days,
      },
      membership: {
        id: row.membership_id,
        organizationId: row.organization_id,
        userId: row.user_id,
        role: row.membership_role,
      },
    });
  }

  async createFirstOrganization(input: { userId: string; name: string; email: string; organizationId: string; organizationName: string; organizationSlug: string; membershipId: string; auditEventId: string; timezone: string; defaultLocale: string }): Promise<void> {
    await this.query(
      `WITH created_user AS (INSERT INTO users (id, email, name) VALUES ($1, $2, $3) RETURNING id),
      created_organization AS (INSERT INTO organizations (id, name, slug, timezone, default_locale) SELECT $4, $5, $6, $7, $8 FROM created_user RETURNING id),
      created_membership AS (INSERT INTO organization_members (id, organization_id, user_id, role) SELECT $9, created_organization.id, created_user.id, 'admin' FROM created_organization CROSS JOIN created_user RETURNING id)
      INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
      SELECT $10, $4, $1, 'organization.created', 'organization', $4, json_build_object('role', 'admin') FROM created_membership`,
      [input.userId, input.email, input.name, input.organizationId, input.organizationName, input.organizationSlug, input.timezone, input.defaultLocale, input.membershipId, input.auditEventId],
    );
  }

  async createSession(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [input.id, input.userId, input.tokenHash, input.expiresAt]);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
  }
}
