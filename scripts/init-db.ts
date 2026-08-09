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

    console.log('👥 Creating candidate ingestion tables...');
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, display_name TEXT NOT NULL, headline TEXT, location TEXT, profile_status TEXT NOT NULL DEFAULT 'unreviewed', merged_into_id TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS ingestion_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT, source_type TEXT NOT NULL, status TEXT NOT NULL, total_count INTEGER NOT NULL, completed_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS candidate_sources (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES candidates(id), ingestion_run_id TEXT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE, source_type TEXT NOT NULL, permission_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','scanning','extracting','parsed','needs_review','failed')), source_label TEXT NOT NULL, imported_by_id TEXT NOT NULL, imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, warnings JSON NOT NULL DEFAULT '[]'::JSON);
      CREATE TABLE IF NOT EXISTS candidate_documents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, source_id TEXT NOT NULL UNIQUE REFERENCES candidate_sources(id) ON DELETE CASCADE, storage_key TEXT NOT NULL, original_filename TEXT NOT NULL, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, checksum TEXT NOT NULL, page_count INTEGER, malware_scan_status TEXT NOT NULL, pdf_type TEXT, parsed_text_markdown TEXT, pages_needing_ocr JSON NOT NULL DEFAULT '[]'::JSON, extractor TEXT, extractor_version TEXT, extraction_confidence DOUBLE PRECISION, processing_time_ms INTEGER, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,checksum));
      CREATE TABLE IF NOT EXISTS candidate_identities (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, identity_type TEXT NOT NULL, normalized_value TEXT, value_fingerprint TEXT NOT NULL, raw_value_encrypted TEXT, verified BOOLEAN NOT NULL DEFAULT FALSE, source_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,identity_type,value_fingerprint));
      CREATE TABLE IF NOT EXISTS external_profile_links (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, source_id TEXT NOT NULL, provider TEXT NOT NULL, profile_url TEXT NOT NULL, external_id TEXT, retrieval_method TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, position_id TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'applied', created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,candidate_id,position_id));
      CREATE TABLE IF NOT EXISTS duplicate_reviews (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL, possible_candidate_id TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('same_candidate','possible_duplicate','distinct')), confidence DOUBLE PRECISION NOT NULL, signals JSON NOT NULL, status TEXT NOT NULL DEFAULT 'pending', resolved_by_id TEXT, resolved_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidates_org_created_idx ON candidates(organization_id,created_at);
      CREATE INDEX IF NOT EXISTS ingestion_runs_org_created_idx ON ingestion_runs(organization_id,created_at);
      CREATE INDEX IF NOT EXISTS candidate_sources_org_candidate_idx ON candidate_sources(organization_id,candidate_id);
      CREATE INDEX IF NOT EXISTS candidate_identities_org_candidate_idx ON candidate_identities(organization_id,candidate_id);
      CREATE INDEX IF NOT EXISTS external_profile_links_org_candidate_idx ON external_profile_links(organization_id,candidate_id);
      CREATE INDEX IF NOT EXISTS applications_org_position_idx ON applications(organization_id,position_id);
      CREATE INDEX IF NOT EXISTS duplicate_reviews_org_status_idx ON duplicate_reviews(organization_id,status);

      CREATE TABLE IF NOT EXISTS evidence_claims (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES candidate_sources(id) ON DELETE CASCADE, claim_type TEXT NOT NULL CHECK(claim_type IN ('employment','education','project','skill','certification','language','logistics','other')), label TEXT NOT NULL, claim_value TEXT NOT NULL, claim_status TEXT NOT NULL CHECK(claim_status IN ('explicit','inferred','externally_evidenced','contradicted','unverified')), page_number INTEGER, section_label TEXT, excerpt TEXT, extractor_version TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL CHECK(confidence BETWEEN 0 AND 1), created_by_type TEXT NOT NULL CHECK(created_by_type IN ('model','human','import')), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS evidence_claim_corrections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, claim_id TEXT NOT NULL REFERENCES evidence_claims(id) ON DELETE CASCADE, action TEXT NOT NULL CHECK(action IN ('confirm','reject','correct')), corrected_value TEXT, reason TEXT NOT NULL, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS evidence_claims_org_candidate_idx ON evidence_claims(organization_id,candidate_id,created_at);
      CREATE INDEX IF NOT EXISTS evidence_corrections_org_claim_idx ON evidence_claim_corrections(organization_id,claim_id,created_at);

      CREATE TABLE IF NOT EXISTS candidate_evaluations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, position_id TEXT NOT NULL, rubric_id TEXT NOT NULL REFERENCES evaluation_rubrics(id), rubric_version INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','evaluated','stale','failed')), role_fit INTEGER CHECK(role_fit BETWEEN 0 AND 100), evidence_confidence INTEGER CHECK(evidence_confidence BETWEEN 0 AND 100), recommendation TEXT CHECK(recommendation IN ('strong_review','review','needs_information','low_match')), evidence_snapshot JSON NOT NULL, provider_execution_id TEXT, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS criterion_evaluations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id) ON DELETE CASCADE, criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id), rating TEXT NOT NULL CHECK(rating IN ('strong','meets','partial','missing','contradicted')), score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100), evidence_confidence INTEGER NOT NULL CHECK(evidence_confidence BETWEEN 0 AND 100), reasoning TEXT NOT NULL, evidence_claim_ids JSON NOT NULL DEFAULT '[]'::JSON, gaps JSON NOT NULL DEFAULT '[]'::JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidate_evaluations_org_position_idx ON candidate_evaluations(organization_id,position_id,created_at);
      CREATE INDEX IF NOT EXISTS candidate_evaluations_org_candidate_idx ON candidate_evaluations(organization_id,candidate_id,created_at);
      CREATE INDEX IF NOT EXISTS criterion_evaluations_org_evaluation_idx ON criterion_evaluations(organization_id,candidate_evaluation_id);
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
