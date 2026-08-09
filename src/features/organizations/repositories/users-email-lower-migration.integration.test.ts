import { afterEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationSql = readFileSync(
  join(
    import.meta.dir,
    '../../../../prisma/migrations/20260809140000_users_email_lower_unique/migration.sql',
  ),
  'utf8',
);

async function createLegacyUsersSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX users_email_key ON users (email);
  `);
}

async function indexNames(db: PGlite): Promise<string[]> {
  const result = await db.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'users'
    ORDER BY indexname
  `);
  return result.rows.map((row) => row.indexname);
}

describe('users email lower unique migration', () => {
  let db: PGlite | undefined;

  afterEach(async () => {
    if (db) {
      await db.close();
      db = undefined;
    }
  });

  test('upgrades case-sensitive uniqueness to LOWER(email) without a uniqueness gap', async () => {
    db = new PGlite();
    await db.waitReady;
    await createLegacyUsersSchema(db);
    await db.exec(`
      INSERT INTO users (id, email, name) VALUES
        ('user-1', 'User@Company.com', 'Asha'),
        ('user-2', 'other@company.com', 'Ravi');
    `);

    expect(await indexNames(db)).toContain('users_email_key');

    await db.exec(migrationSql);

    const indexes = await indexNames(db);
    expect(indexes).toContain('users_email_lower_key');
    expect(indexes).not.toContain('users_email_key');

    const emails = await db.query<{ email: string }>(
      'SELECT email FROM users ORDER BY id',
    );
    expect(emails.rows.map((row) => row.email)).toEqual([
      'user@company.com',
      'other@company.com',
    ]);

    await expect(
      db.exec(`INSERT INTO users (id, email, name) VALUES ('user-3', 'USER@company.com', 'Dup')`),
    ).rejects.toThrow(/users_email_lower_key|unique|duplicate/i);
  });

  test('refuses to migrate when case-insensitive duplicates already exist', async () => {
    db = new PGlite();
    await db.waitReady;
    await createLegacyUsersSchema(db);
    await db.exec(`
      INSERT INTO users (id, email, name) VALUES
        ('user-1', 'User@Company.com', 'Asha'),
        ('user-2', 'user@company.com', 'Ravi');
    `);

    await expect(db.exec(migrationSql)).rejects.toThrow(
      /Cannot enforce case-insensitive email uniqueness/i,
    );
    // Prisma-style explicit BEGIN leaves the session aborted after RAISE; clear it.
    await db.exec('ROLLBACK');

    const indexes = await indexNames(db);
    expect(indexes).toContain('users_email_key');
    expect(indexes).not.toContain('users_email_lower_key');

    const emails = await db.query<{ email: string }>(
      'SELECT email FROM users ORDER BY id',
    );
    expect(emails.rows.map((row) => row.email)).toEqual([
      'User@Company.com',
      'user@company.com',
    ]);
  });
});
