import { executeQuery } from '@/lib/db';

type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class AuthenticationRepository {
  constructor(private readonly query: Query = executeQuery) {}

  async findUserForSignIn(email: string): Promise<{ id: string; passwordHash: string; organizationSlug: string } | null> {
    const rows = await this.query(
      `SELECT users.id, users.password_hash, organizations.slug AS organization_slug
       FROM users
       INNER JOIN organization_members ON organization_members.user_id = users.id
       INNER JOIN organizations ON organizations.id = organization_members.organization_id
       WHERE LOWER(users.email) = LOWER($1) AND users.password_hash IS NOT NULL AND organizations.status = 'active'
       ORDER BY organization_members.created_at ASC LIMIT 1`,
      [email],
    ) as { id: string; password_hash: string; organization_slug: string }[];
    return rows[0] ? { id: rows[0].id, passwordHash: rows[0].password_hash, organizationSlug: rows[0].organization_slug } : null;
  }
}
