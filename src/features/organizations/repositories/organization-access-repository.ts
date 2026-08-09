import { executeQuery } from '@/lib/db';
import {
  InvitationViewSchema,
  InvitationAcceptanceViewSchema,
  OrganizationMemberViewSchema,
  ResolvedOrganizationAccessSchema,
  type InvitationView,
  type InvitationAcceptanceView,
  type OrganizationMemberView,
  type OrganizationRole,
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

  async findSetupConflicts(email: string, organizationSlug: string): Promise<{ emailTaken: boolean; slugTaken: boolean }> {
    const rows = await this.query(
      `SELECT
        EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)) AS email_taken,
        EXISTS(SELECT 1 FROM organizations WHERE slug = $2) AS slug_taken`,
      [email, organizationSlug],
    ) as { email_taken: boolean; slug_taken: boolean }[];
    const row = rows[0];
    return {
      emailTaken: Boolean(row?.email_taken),
      slugTaken: Boolean(row?.slug_taken),
    };
  }

  async createFirstOrganizationWithSession(input: {
    userId: string;
    name: string;
    email: string;
    passwordHash: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    membershipId: string;
    auditEventId: string;
    timezone: string;
    defaultLocale: string;
    sessionId: string;
    sessionTokenHash: string;
    sessionExpiresAt: Date;
  }): Promise<void> {
    await this.query(
      `WITH created_user AS (
        INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $11) RETURNING id
      ), created_organization AS (
        INSERT INTO organizations (id, name, slug, timezone, default_locale)
        SELECT $4, $5, $6, $7, $8 FROM created_user RETURNING id
      ), created_membership AS (
        INSERT INTO organization_members (id, organization_id, user_id, role)
        SELECT $9, created_organization.id, created_user.id, 'admin'
        FROM created_organization CROSS JOIN created_user RETURNING id
      ), created_audit AS (
        INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
        SELECT $10, $4, $1, 'organization.created', 'organization', $4, json_build_object('role', 'admin')
        FROM created_membership RETURNING id
      )
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      SELECT $12, created_user.id, $13, $14 FROM created_user CROSS JOIN created_audit`,
      [
        input.userId,
        input.email,
        input.name,
        input.organizationId,
        input.organizationName,
        input.organizationSlug,
        input.timezone,
        input.defaultLocale,
        input.membershipId,
        input.auditEventId,
        input.passwordHash,
        input.sessionId,
        input.sessionTokenHash,
        input.sessionExpiresAt,
      ],
    );
  }

  async createSession(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [input.id, input.userId, input.tokenHash, input.expiresAt]);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.query(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
  }

  async listMembers(organizationId: string, currentUserId: string): Promise<OrganizationMemberView[]> {
    const rows = await this.query(
      `SELECT organization_members.id, users.name, users.email, organization_members.role,
        organization_members.created_at AS joined_at,
        CASE WHEN users.id = $2 THEN TRUE ELSE FALSE END AS is_current_user
      FROM organization_members
      INNER JOIN users ON users.id = organization_members.user_id
      WHERE organization_members.organization_id = $1
      ORDER BY organization_members.created_at ASC`,
      [organizationId, currentUserId],
    );
    return rows.map((row) => OrganizationMemberViewSchema.parse({
      ...(row as Record<string, unknown>),
      joinedAt: (row as Record<string, unknown>).joined_at,
      isCurrentUser: (row as Record<string, unknown>).is_current_user,
    }));
  }

  async listInvitations(organizationId: string): Promise<InvitationView[]> {
    const rows = await this.query(
      `SELECT id, email, role,
        CASE WHEN status = 'pending' AND expires_at <= CURRENT_TIMESTAMP THEN 'expired' ELSE status END AS status,
        expires_at, created_at
      FROM invitations
      WHERE organization_id = $1
      ORDER BY created_at DESC`,
      [organizationId],
    );
    return rows.map((row) => InvitationViewSchema.parse({
      ...(row as Record<string, unknown>),
      expiresAt: (row as Record<string, unknown>).expires_at,
      createdAt: (row as Record<string, unknown>).created_at,
    }));
  }

  async createInvitation(input: { id: string; organizationId: string; email: string; role: OrganizationRole; tokenHash: string; invitedById: string; expiresAt: Date; auditEventId: string }): Promise<boolean> {
    const rows = await this.query(
      `WITH created_invitation AS (
        INSERT INTO invitations (id, organization_id, email, role, token_hash, invited_by_id, expires_at)
        SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (
          SELECT 1 FROM invitations
          WHERE organization_id = $2 AND LOWER(email) = LOWER($3) AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
        )
        RETURNING id
      ), audited AS (
      INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
      SELECT $8, $2, $6, 'invitation.created', 'invitation', id,
        json_build_object('email', $3::TEXT, 'role', $4::TEXT)
      FROM created_invitation
      ) SELECT EXISTS(SELECT 1 FROM created_invitation) AS created`,
      [input.id, input.organizationId, input.email, input.role, input.tokenHash, input.invitedById, input.expiresAt, input.auditEventId],
    ) as { created: boolean }[];
    return rows[0]?.created ?? false;
  }

  async revokeInvitation(input: { invitationId: string; organizationId: string; actorUserId: string; auditEventId: string }): Promise<boolean> {
    const rows = await this.query(
      `WITH revoked AS (
        UPDATE invitations SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
        RETURNING id, email, role
      ), audited AS (
        INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
        SELECT $4, $2, $3, 'invitation.revoked', 'invitation', id, json_build_object('email', email, 'role', role) FROM revoked
      ) SELECT EXISTS(SELECT 1 FROM revoked) AS revoked`,
      [input.invitationId, input.organizationId, input.actorUserId, input.auditEventId],
    ) as { revoked: boolean }[];
    return rows[0]?.revoked ?? false;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationAcceptanceView | null> {
    const rows = await this.query(
      `SELECT invitations.id AS invitation_id, invitations.organization_id,
        organizations.name AS organization_name, organizations.slug AS organization_slug,
        invitations.email, invitations.role,
        CASE WHEN invitations.status = 'pending' AND invitations.expires_at <= CURRENT_TIMESTAMP THEN 'expired' ELSE invitations.status END AS status,
        invitations.expires_at
      FROM invitations INNER JOIN organizations ON organizations.id = invitations.organization_id
      WHERE invitations.token_hash = $1 AND organizations.status = 'active' LIMIT 1`, [tokenHash],
    ) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return null;
    return InvitationAcceptanceViewSchema.parse({ invitationId: row.invitation_id, organizationId: row.organization_id,
      organizationName: row.organization_name, organizationSlug: row.organization_slug, email: row.email,
      role: row.role, status: row.status, expiresAt: row.expires_at });
  }

  async acceptInvitation(input: { tokenHash: string; name: string; passwordHash: string; userId: string; membershipId: string; sessionId: string; sessionTokenHash: string; sessionExpiresAt: Date; auditEventId: string }): Promise<{ organizationSlug: string } | null> {
    const rows = await this.query(
      `WITH eligible AS (
        SELECT invitations.id, invitations.organization_id, invitations.email, invitations.role, organizations.slug
        FROM invitations INNER JOIN organizations ON organizations.id = invitations.organization_id
        WHERE invitations.token_hash = $1 AND invitations.status = 'pending'
          AND invitations.expires_at > CURRENT_TIMESTAMP AND organizations.status = 'active' FOR UPDATE OF invitations
      ), ensured_user AS (
        INSERT INTO users (id, email, name, password_hash) SELECT $2, LOWER(email), $3, $9 FROM eligible
        ON CONFLICT (email) DO UPDATE SET name = CASE WHEN users.name = '' THEN EXCLUDED.name ELSE users.name END,
          password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash) RETURNING id
      ), created_membership AS (
        INSERT INTO organization_members (id, organization_id, user_id, role)
        SELECT $4, eligible.organization_id, ensured_user.id, eligible.role FROM eligible CROSS JOIN ensured_user
        ON CONFLICT (organization_id, user_id) DO NOTHING RETURNING id
      ), accepted AS (
        UPDATE invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT id FROM eligible) RETURNING id, organization_id
      ), created_session AS (
        INSERT INTO sessions (id, user_id, token_hash, expires_at)
        SELECT $5, ensured_user.id, $6, $7 FROM ensured_user WHERE EXISTS (SELECT 1 FROM accepted) RETURNING id
      ), audited AS (
        INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
        SELECT $8, accepted.organization_id, ensured_user.id, 'invitation.accepted', 'invitation', accepted.id,
          json_build_object('membership_created', EXISTS(SELECT 1 FROM created_membership))
        FROM accepted CROSS JOIN ensured_user WHERE EXISTS (SELECT 1 FROM created_session)
      ) SELECT eligible.slug AS organization_slug FROM eligible
      WHERE EXISTS (SELECT 1 FROM accepted) AND EXISTS (SELECT 1 FROM created_session)`,
      [input.tokenHash, input.userId, input.name, input.membershipId, input.sessionId, input.sessionTokenHash, input.sessionExpiresAt, input.auditEventId, input.passwordHash],
    ) as { organization_slug: string }[];
    return rows[0] ? { organizationSlug: rows[0].organization_slug } : null;
  }

  async updateMemberRole(input: { organizationId: string; membershipId: string; actorUserId: string; role: OrganizationRole; auditEventId: string }): Promise<boolean> {
    const rows = await this.query(
      `WITH previous AS (
        SELECT id, role FROM organization_members WHERE id = $1 AND organization_id = $2
      ), updated AS (
        UPDATE organization_members SET role = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2 AND role <> $3
        RETURNING id
      ), audited AS (
        INSERT INTO audit_events (id, organization_id, actor_user_id, action, subject_type, subject_id, metadata)
        SELECT $5, $2, $4, 'membership.role_changed', 'organization_member', updated.id,
          json_build_object('from', previous.role, 'to', $3::TEXT)
        FROM updated INNER JOIN previous ON previous.id = updated.id
      )
      SELECT EXISTS(SELECT 1 FROM updated) AS changed`,
      [input.membershipId, input.organizationId, input.role, input.actorUserId, input.auditEventId],
    ) as { changed: boolean }[];
    return rows[0]?.changed ?? false;
  }
}
