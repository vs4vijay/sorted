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
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

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
      CREATE TABLE IF NOT EXISTS voice_notes (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE, purpose TEXT NOT NULL CHECK(purpose IN ('position_requirement','screening_note','panel_feedback')), language_code TEXT NOT NULL, consent_recorded_by_id TEXT NOT NULL, consent_recorded_at TIMESTAMP NOT NULL, storage_key TEXT, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, checksum TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('uploaded','transcribing','succeeded','simulated','failed','approved')), transcript TEXT, transcript_data JSON, provider_execution_id TEXT REFERENCES provider_executions(id), reviewed_transcript TEXT, reviewed_by_id TEXT, reviewed_at TIMESTAMP, source_deleted_at TIMESTAMP, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS voice_notes_org_position_idx ON voice_notes(organization_id,position_id,created_at);
    `);

    console.log('👥 Creating candidate ingestion tables...');
    await pglite.exec(`
      CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, display_name TEXT NOT NULL, headline TEXT, location TEXT, profile_status TEXT NOT NULL DEFAULT 'unreviewed', merged_into_id TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS ingestion_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, position_id TEXT, source_type TEXT NOT NULL, status TEXT NOT NULL, total_count INTEGER NOT NULL, completed_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS candidate_sources (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT REFERENCES candidates(id), ingestion_run_id TEXT NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE, source_type TEXT NOT NULL, permission_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','scanning','extracting','parsed','needs_review','failed','quarantined')), source_label TEXT NOT NULL, imported_by_id TEXT NOT NULL, imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, warnings JSON NOT NULL DEFAULT '[]'::JSON);
      CREATE TABLE IF NOT EXISTS candidate_documents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, source_id TEXT NOT NULL UNIQUE REFERENCES candidate_sources(id) ON DELETE CASCADE, storage_key TEXT NOT NULL, original_filename TEXT NOT NULL, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL, checksum TEXT NOT NULL, page_count INTEGER, malware_scan_status TEXT NOT NULL, malware_scan_provider TEXT, malware_scan_version TEXT, malware_scan_request_id TEXT, malware_scan_error TEXT, malware_scanned_at TIMESTAMP, pdf_type TEXT, parsed_text_markdown TEXT, pages_needing_ocr JSON NOT NULL DEFAULT '[]'::JSON, extractor TEXT, extractor_version TEXT, extraction_confidence DOUBLE PRECISION, processing_time_ms INTEGER, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,checksum));
      ALTER TABLE candidate_documents ADD COLUMN IF NOT EXISTS malware_scan_provider TEXT;
      ALTER TABLE candidate_documents ADD COLUMN IF NOT EXISTS malware_scan_version TEXT;
      ALTER TABLE candidate_documents ADD COLUMN IF NOT EXISTS malware_scan_request_id TEXT;
      ALTER TABLE candidate_documents ADD COLUMN IF NOT EXISTS malware_scan_error TEXT;
      ALTER TABLE candidate_documents ADD COLUMN IF NOT EXISTS malware_scanned_at TIMESTAMP;
      ALTER TABLE candidate_sources DROP CONSTRAINT IF EXISTS candidate_sources_status_check;
      ALTER TABLE candidate_sources ADD CONSTRAINT candidate_sources_status_check CHECK(status IN ('uploaded','scanning','extracting','parsed','needs_review','failed','quarantined'));
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
      CREATE TABLE IF NOT EXISTS candidate_privacy_requests (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id), request_type TEXT NOT NULL CHECK(request_type IN ('correction','export','deletion')), status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','completed','declined')), details TEXT NOT NULL, requested_by_id TEXT, request_source TEXT NOT NULL DEFAULT 'recruiter_recorded', requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_by_id TEXT, decided_at TIMESTAMP, decision_rationale TEXT, completed_at TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidate_privacy_requests_org_candidate_idx ON candidate_privacy_requests(organization_id,candidate_id,requested_at);
      CREATE INDEX IF NOT EXISTS candidate_privacy_requests_org_status_idx ON candidate_privacy_requests(organization_id,status,requested_at);
      CREATE TABLE IF NOT EXISTS candidate_privacy_access_tokens (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_used_at TIMESTAMP, revoked_at TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidate_privacy_access_tokens_org_candidate_idx ON candidate_privacy_access_tokens(organization_id,candidate_id,expires_at);
      ALTER TABLE candidate_privacy_requests ALTER COLUMN requested_by_id DROP NOT NULL;
      ALTER TABLE candidate_privacy_requests ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'recruiter_recorded';

      CREATE TABLE IF NOT EXISTS evidence_claims (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES candidate_sources(id) ON DELETE CASCADE, claim_type TEXT NOT NULL CHECK(claim_type IN ('employment','education','project','skill','certification','language','logistics','other')), label TEXT NOT NULL, claim_value TEXT NOT NULL, claim_status TEXT NOT NULL CHECK(claim_status IN ('explicit','inferred','externally_evidenced','contradicted','unverified')), page_number INTEGER, section_label TEXT, excerpt TEXT, extractor_version TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL CHECK(confidence BETWEEN 0 AND 1), created_by_type TEXT NOT NULL CHECK(created_by_type IN ('model','human','import')), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS evidence_claim_corrections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, claim_id TEXT NOT NULL REFERENCES evidence_claims(id) ON DELETE CASCADE, action TEXT NOT NULL CHECK(action IN ('confirm','reject','correct')), corrected_value TEXT, reason TEXT NOT NULL, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS evidence_claims_org_candidate_idx ON evidence_claims(organization_id,candidate_id,created_at);
      CREATE INDEX IF NOT EXISTS evidence_corrections_org_claim_idx ON evidence_claim_corrections(organization_id,claim_id,created_at);

      CREATE TABLE IF NOT EXISTS candidate_evaluations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, position_id TEXT NOT NULL, rubric_id TEXT NOT NULL REFERENCES evaluation_rubrics(id), rubric_version INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','evaluated','stale','failed')), role_fit INTEGER CHECK(role_fit BETWEEN 0 AND 100), evidence_confidence INTEGER CHECK(evidence_confidence BETWEEN 0 AND 100), recommendation TEXT CHECK(recommendation IN ('strong_review','review','needs_information','low_match')), evidence_snapshot JSON NOT NULL, provider_execution_id TEXT, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS criterion_evaluations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id) ON DELETE CASCADE, criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id), rating TEXT NOT NULL CHECK(rating IN ('strong','meets','partial','missing','contradicted')), score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100), evidence_confidence INTEGER NOT NULL CHECK(evidence_confidence BETWEEN 0 AND 100), reasoning TEXT NOT NULL, evidence_claim_ids JSON NOT NULL DEFAULT '[]'::JSON, gaps JSON NOT NULL DEFAULT '[]'::JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidate_evaluations_org_position_idx ON candidate_evaluations(organization_id,position_id,created_at);
      CREATE INDEX IF NOT EXISTS candidate_evaluations_org_candidate_idx ON candidate_evaluations(organization_id,candidate_id,created_at);
      CREATE INDEX IF NOT EXISTS criterion_evaluations_org_evaluation_idx ON criterion_evaluations(organization_id,candidate_evaluation_id);

      CREATE TABLE IF NOT EXISTS review_assignments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id) ON DELETE CASCADE, reviewer_member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'not_started' CHECK(state IN ('not_started','in_review','submitted','changes_requested')), assigned_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,candidate_evaluation_id,reviewer_member_id));
      CREATE TABLE IF NOT EXISTS panel_reviews (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, assignment_id TEXT NOT NULL REFERENCES review_assignments(id), candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id), reviewer_member_id TEXT NOT NULL REFERENCES organization_members(id), recommendation TEXT NOT NULL CHECK(recommendation IN ('shortlist','hold','needs_information','do_not_advance')), summary TEXT NOT NULL, criterion_feedback JSON NOT NULL DEFAULT '{}'::JSON, submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS review_comments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id), criterion_id TEXT, evidence_claim_id TEXT, author_member_id TEXT NOT NULL REFERENCES organization_members(id), body TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS shortlist_decisions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_evaluation_id TEXT NOT NULL REFERENCES candidate_evaluations(id), candidate_id TEXT NOT NULL REFERENCES candidates(id), position_id TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('shortlisted','hold','not_advancing')), rationale TEXT NOT NULL, decided_by_id TEXT NOT NULL, decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS decision_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, shortlist_decision_id TEXT NOT NULL REFERENCES shortlist_decisions(id), event_type TEXT NOT NULL, actor_user_id TEXT NOT NULL, metadata JSON NOT NULL DEFAULT '{}'::JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, recipient_member_id TEXT NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE, kind TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, body TEXT NOT NULL, read_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS review_assignments_org_reviewer_idx ON review_assignments(organization_id,reviewer_member_id,state);
      CREATE INDEX IF NOT EXISTS panel_reviews_org_evaluation_idx ON panel_reviews(organization_id,candidate_evaluation_id,submitted_at);
      CREATE INDEX IF NOT EXISTS review_comments_org_evaluation_idx ON review_comments(organization_id,candidate_evaluation_id,created_at);
      CREATE INDEX IF NOT EXISTS shortlist_decisions_org_evaluation_idx ON shortlist_decisions(organization_id,candidate_evaluation_id,decided_at);
      CREATE INDEX IF NOT EXISTS decision_events_org_decision_idx ON decision_events(organization_id,shortlist_decision_id,created_at);
      CREATE INDEX IF NOT EXISTS notifications_org_recipient_idx ON notifications(organization_id,recipient_member_id,created_at);
      CREATE TABLE IF NOT EXISTS message_templates (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, purpose TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS outreach_threads (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id), application_id TEXT, position_id TEXT, purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', requested_fields JSON NOT NULL DEFAULT '[]'::JSON, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS outreach_messages (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, thread_id TEXT NOT NULL REFERENCES outreach_threads(id), direction TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', approval_version INTEGER NOT NULL DEFAULT 0, approved_by_id TEXT, approved_at TIMESTAMP, provider TEXT, provider_message_id TEXT, idempotency_key TEXT NOT NULL UNIQUE, sent_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS candidate_responses (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, thread_id TEXT NOT NULL REFERENCES outreach_threads(id), provider_event_id TEXT NOT NULL, body TEXT NOT NULL, parsed_suggestions JSON NOT NULL DEFAULT '[]'::JSON, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,provider_event_id));
      CREATE TABLE IF NOT EXISTS delivery_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, thread_id TEXT NOT NULL REFERENCES outreach_threads(id), message_id TEXT, provider_event_id TEXT NOT NULL, event_type TEXT NOT NULL, metadata JSON NOT NULL DEFAULT '{}'::JSON, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,provider_event_id));
      CREATE TABLE IF NOT EXISTS opt_outs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id), thread_id TEXT, channel TEXT NOT NULL, reason TEXT, recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,candidate_id,channel));
      CREATE INDEX IF NOT EXISTS outreach_threads_org_candidate_idx ON outreach_threads(organization_id,candidate_id,updated_at);
      CREATE INDEX IF NOT EXISTS outreach_messages_org_thread_idx ON outreach_messages(organization_id,thread_id,created_at);
      CREATE TABLE IF NOT EXISTS candidate_communication_preferences (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id), channel TEXT NOT NULL, language_code TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('opted_in','withdrawn')), source TEXT NOT NULL, recorded_by_id TEXT NOT NULL, recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, withdrawn_at TIMESTAMP, UNIQUE(organization_id,candidate_id,channel,language_code));
      CREATE INDEX IF NOT EXISTS candidate_communication_preferences_org_candidate_idx ON candidate_communication_preferences(organization_id,candidate_id,status);
      CREATE TABLE IF NOT EXISTS candidate_audio_assets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id), message_id TEXT NOT NULL REFERENCES outreach_messages(id), text_hash TEXT NOT NULL, text_approval_version INTEGER NOT NULL, language_code TEXT NOT NULL, voice TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','ready','simulated','failed','invalidated')), provider TEXT, model TEXT, schema_version TEXT NOT NULL, provider_request_id TEXT, storage_key TEXT, media_type TEXT, byte_size INTEGER, normalized_error TEXT, generated_by_id TEXT NOT NULL, generated_at TIMESTAMP, expires_at TIMESTAMP NOT NULL, invalidated_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS candidate_audio_assets_org_message_idx ON candidate_audio_assets(organization_id,message_id,created_at);
      CREATE INDEX IF NOT EXISTS candidate_audio_assets_org_candidate_idx ON candidate_audio_assets(organization_id,candidate_id,status);
      CREATE TABLE IF NOT EXISTS outreach_sequences (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', business_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', max_attempts INTEGER NOT NULL DEFAULT 1, created_by_id TEXT NOT NULL, approved_by_id TEXT, approved_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS outreach_steps (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, sequence_id TEXT NOT NULL REFERENCES outreach_sequences(id), step_order INTEGER NOT NULL, delay_business_days INTEGER NOT NULL CHECK(delay_business_days BETWEEN 1 AND 14), subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', UNIQUE(organization_id,sequence_id,step_order));
      CREATE TABLE IF NOT EXISTS sequence_enrollments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, sequence_id TEXT NOT NULL REFERENCES outreach_sequences(id), thread_id TEXT NOT NULL REFERENCES outreach_threads(id), status TEXT NOT NULL DEFAULT 'scheduled', current_step INTEGER NOT NULL DEFAULT 1, attempts INTEGER NOT NULL DEFAULT 0, next_run_at TIMESTAMP, stop_reason TEXT, stopped_at TIMESTAMP, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS sequence_enrollments_org_due_idx ON sequence_enrollments(organization_id,status,next_run_at);
      CREATE TABLE IF NOT EXISTS pipeline_handoff_snapshots (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, application_id TEXT NOT NULL, candidate_id TEXT NOT NULL, position_id TEXT NOT NULL, shortlist_decision_id TEXT NOT NULL, candidate_evaluation_id TEXT NOT NULL, rubric_id TEXT NOT NULL, rubric_version INTEGER NOT NULL, evidence_snapshot JSON NOT NULL, response_thread_id TEXT NOT NULL, rationale TEXT NOT NULL, advanced_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS pipeline_stage_transitions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, application_id TEXT NOT NULL, from_stage TEXT NOT NULL, to_stage TEXT NOT NULL, actor_user_id TEXT NOT NULL, rationale TEXT NOT NULL, snapshot_id TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS pipeline_stage_transitions_org_app_idx ON pipeline_stage_transitions(organization_id,application_id,created_at);
      CREATE TABLE IF NOT EXISTS rate_limit_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS rate_limit_events_scope_idx ON rate_limit_events(organization_id,actor_id,action,created_at);
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
