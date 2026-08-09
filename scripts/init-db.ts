#!/usr/bin/env bun

import { PGlite } from '@electric-sql/pglite';

function generateCuid() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${randomStr}`;
}

async function main() {
  console.log('🗄️  Initializing PGlite database...');

  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

  if (!databaseUrl.startsWith('file:')) {
    console.error('❌ This script is for PGlite initialization only.');
    console.error('   For PostgreSQL, use: bun run db:migrate');
    process.exit(1);
  }

  const dbPath = databaseUrl.replace('file:', '');

  const pglite = new PGlite(dbPath);
  await pglite.waitReady;

  try {
    console.log('📋 Creating tables...');

    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('🏢 Creating organization and access tables...');

    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        default_locale TEXT NOT NULL DEFAULT 'en-IN',
        retention_days INTEGER NOT NULL DEFAULT 730 CHECK (retention_days BETWEEN 30 AND 3650),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'hiring_manager', 'technical_reviewer')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organization_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'hiring_manager', 'technical_reviewer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
        token_hash TEXT NOT NULL UNIQUE,
        invited_by_id TEXT NOT NULL REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        metadata JSON NOT NULL DEFAULT '{}'::JSON,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members (user_id);
      CREATE INDEX IF NOT EXISTS invitations_organization_status_idx ON invitations (organization_id, status);
      CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx ON sessions (user_id, expires_at);
      CREATE INDEX IF NOT EXISTS audit_events_organization_created_idx ON audit_events (organization_id, created_at);
      CREATE INDEX IF NOT EXISTS audit_events_subject_idx ON audit_events (organization_id, subject_type, subject_id);
    `);

    console.log('📋 Creating position and rubric tables...');
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','rubric_review','screening','closed')), employment_type TEXT NOT NULL, location TEXT, workplace_preference TEXT, compensation_min INTEGER, compensation_max INTEGER, minimum_experience INTEGER, preferred_experience INTEGER, notice_period_days INTEGER, shift_travel TEXT, work_authorization TEXT, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS positions_org_created_idx ON positions(organization_id, created_at);
      CREATE TABLE IF NOT EXISTS provider_executions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, provider TEXT NOT NULL, operation TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL, schema_version TEXT NOT NULL, provider_request_id TEXT, latency_ms INTEGER, status TEXT NOT NULL, normalized_error JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS provider_executions_org_created_idx ON provider_executions(organization_id, created_at);
      CREATE TABLE IF NOT EXISTS job_descriptions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE, version INTEGER NOT NULL, source_type TEXT NOT NULL, raw_text TEXT, structured_data JSON NOT NULL DEFAULT '{}'::JSON, extraction_mode TEXT NOT NULL, provider_execution_id TEXT, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id, position_id, version));
      CREATE TABLE IF NOT EXISTS evaluation_rubrics (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE, version INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','superseded')), approved_by_id TEXT, approved_at TIMESTAMP, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id, position_id, version));
      CREATE TABLE IF NOT EXISTS rubric_criteria (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, rubric_id TEXT NOT NULL REFERENCES evaluation_rubrics(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL, criterion_type TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('must_have','preferred','logistics','informational')), weight INTEGER NOT NULL CHECK(weight BETWEEN 0 AND 100), evidence_expectations TEXT NOT NULL, display_order INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS rubric_criteria_org_rubric_idx ON rubric_criteria(organization_id, rubric_id, display_order);
      CREATE TABLE IF NOT EXISTS hiring_panel_members (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE, organization_member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, panel_role TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id, position_id, organization_member_id));
    `);

    console.log('⚙️  Creating Jobs table...');

    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        task_identifier TEXT NOT NULL,
        payload JSON DEFAULT '{}'::JSON NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 25 NOT NULL,
        last_error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_at TIMESTAMP,
        locked_by TEXT,
        completed_at TIMESTAMP,
        key TEXT UNIQUE,
        queue TEXT
      );

      CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx ON jobs (status, run_at);
      CREATE INDEX IF NOT EXISTS jobs_priority_run_at_idx ON jobs (priority, run_at);
      CREATE INDEX IF NOT EXISTS jobs_key_idx ON jobs (key);
    `);

    console.log('✅ Database schema created successfully');

    console.log('🌱 Seeding database...');

    await pglite.exec('DELETE FROM items;');

    const item1Id = generateCuid();
    const item2Id = generateCuid();
    const item3Id = generateCuid();

    await pglite.exec(`
      INSERT INTO items (id, name, description) VALUES
        ('${item1Id}', 'Sample Item 1', 'This is a sample item to demonstrate the system'),
        ('${item2Id}', 'Sample Item 2', 'Another sample item with a background job trigger'),
        ('${item3Id}', 'Sample Item 3', 'Third sample item for testing');
    `);

    console.log('✅ Created 3 sample items');
    console.log('🎉 Database initialization complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: bun run dev');
    console.log('  2. Visit: http://localhost:7070');
    console.log('  3. Check jobs: http://localhost:7070/jobs');

    await pglite.close();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    await pglite.close();
    process.exit(1);
  }
}

main();
