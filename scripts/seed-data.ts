type QueryExecutor = (sql: string, params?: unknown[]) => Promise<unknown>;

type SeedRow = {
  table: string;
  columns: string[];
  values: unknown[];
};

const ORG_ID = 'local-dev-organization';
const ADMIN_ID = 'local-dev-user';
// Synthetic demo credential only. This is a scrypt hash; the plaintext is never stored.
const DEMO_PASSWORD_HASH =
  'scrypt$7FOKi2igsl1qMBtExLfR_g$YUnL7JgcQXagBysk6gdGEWydzdpecNpcUXZiOOCNZf5e56CYlW17zluv6mzTtIj6JfQdd-iIwOM8CqfmfyjFSg';

const json = (value: unknown) => JSON.stringify(value);

function rows(): SeedRow[] {
  const result: SeedRow[] = [];
  const add = (table: string, columns: string[], values: unknown[]) =>
    result.push({ table, columns, values });

  add('users', ['id', 'email', 'name', 'password_hash'], [ADMIN_ID, 'demo@sorted.local', 'Demo User', DEMO_PASSWORD_HASH]);
  add('users', ['id', 'email', 'name', 'password_hash'], ['seed-user-manager', 'vikram@sorted.local', 'Vikram Shah', DEMO_PASSWORD_HASH]);
  add('users', ['id', 'email', 'name', 'password_hash'], ['seed-user-reviewer', 'neha@sorted.local', 'Neha Kulkarni', DEMO_PASSWORD_HASH]);
  add('organizations', ['id', 'name', 'slug', 'timezone', 'default_locale'], [ORG_ID, 'Sorted Local Workspace', 'sorted-local', 'Asia/Kolkata', 'en-IN']);
  add('organization_members', ['id', 'organization_id', 'user_id', 'role'], ['local-dev-membership', ORG_ID, ADMIN_ID, 'admin']);
  add('organization_members', ['id', 'organization_id', 'user_id', 'role'], ['seed-member-manager', ORG_ID, 'seed-user-manager', 'hiring_manager']);
  add('organization_members', ['id', 'organization_id', 'user_id', 'role'], ['seed-member-reviewer', ORG_ID, 'seed-user-reviewer', 'technical_reviewer']);

  const positions = [
    ['seed-senior-backend-engineer', 'Senior Backend Engineer', 'screening', 'Full-time', 'Bengaluru', 'Hybrid', 5, 7],
    ['seed-product-designer', 'Product Designer', 'rubric_review', 'Full-time', 'Mumbai', 'Hybrid', 3, 5],
    ['seed-data-analyst', 'Data Analyst', 'draft', 'Contract', 'Remote · India', 'Remote', 2, 4],
  ];
  for (const position of positions) {
    add('positions', ['id', 'organization_id', 'title', 'status', 'employment_type', 'location', 'workplace_preference', 'minimum_experience', 'preferred_experience', 'created_by_id'], [position[0], ORG_ID, ...position.slice(1), ADMIN_ID]);
  }
  for (const suffix of ['backend', 'designer', 'analyst']) {
    add('provider_executions', ['id', 'organization_id', 'provider', 'operation', 'model', 'prompt_version', 'schema_version', 'status', 'latency_ms'], [`seed-exec-${suffix}`, ORG_ID, 'fixture', 'job_description.structure', 'deterministic-fixture-v1', 'job-description.v1', 'structured-job-description.v1', 'simulated', 0]);
  }
  const jobDescriptions = [
    ['backend', 'seed-senior-backend-engineer', 'Build reliable backend services for a growing Indian fintech platform.', { title: 'Senior Backend Engineer', seniority: 'Senior', skills: ['TypeScript', 'PostgreSQL', 'Distributed systems'] }],
    ['designer', 'seed-product-designer', 'Design accessible product workflows for recruiters and hiring panels.', { title: 'Product Designer', seniority: 'Mid-senior', skills: ['Product design', 'User research', 'Design systems'] }],
    ['analyst', 'seed-data-analyst', 'Turn recruiting operations data into trustworthy reporting and insights.', { title: 'Data Analyst', seniority: 'Mid-level', skills: ['SQL', 'Data visualization', 'Statistics'] }],
  ];
  for (const [suffix, positionId, rawText, structured] of jobDescriptions) {
    add('job_descriptions', ['id', 'organization_id', 'position_id', 'version', 'source_type', 'raw_text', 'structured_data', 'extraction_mode', 'provider_execution_id', 'created_by_id'], [`seed-jd-${suffix}`, ORG_ID, positionId, 1, 'pasted', rawText, json(structured), 'simulated', `seed-exec-${suffix}`, ADMIN_ID]);
  }
  for (const [id, positionId, status] of [
    ['seed-rubric-backend', 'seed-senior-backend-engineer', 'approved'],
    ['seed-rubric-designer', 'seed-product-designer', 'draft'],
    ['seed-rubric-analyst', 'seed-data-analyst', 'draft'],
  ]) {
    add('evaluation_rubrics', ['id', 'organization_id', 'position_id', 'version', 'status', 'approved_by_id', 'approved_at', 'created_by_id'], [id, ORG_ID, positionId, 1, status, status === 'approved' ? ADMIN_ID : null, status === 'approved' ? new Date('2026-08-01T09:00:00Z') : null, ADMIN_ID]);
  }
  const criteria = [
    ['seed-criterion-backend-1', 'seed-rubric-backend', 'Backend systems', 'Has designed and operated production backend services.', 'experience', 'must_have', 40, 'Service ownership with scale or reliability outcomes.', 0],
    ['seed-criterion-backend-2', 'seed-rubric-backend', 'PostgreSQL', 'Can model, query, and tune relational data.', 'skill', 'must_have', 30, 'Schema design, query tuning, or production troubleshooting.', 1],
    ['seed-criterion-backend-3', 'seed-rubric-backend', 'Technical leadership', 'Raises engineering quality through reviews and mentoring.', 'experience', 'preferred', 30, 'Mentoring, design reviews, or cross-team ownership.', 2],
    ['seed-criterion-designer-1', 'seed-rubric-designer', 'Product discovery', 'Turns user needs into clear product direction.', 'experience', 'must_have', 40, 'Research artifacts tied to decisions.', 0],
    ['seed-criterion-designer-2', 'seed-rubric-designer', 'Interaction design', 'Creates usable end-to-end workflows.', 'skill', 'must_have', 35, 'Flows, prototypes, and iteration.', 1],
    ['seed-criterion-designer-3', 'seed-rubric-designer', 'Design systems', 'Contributes reusable accessible patterns.', 'skill', 'preferred', 25, 'Components, governance, or accessibility work.', 2],
    ['seed-criterion-analyst-1', 'seed-rubric-analyst', 'SQL analysis', 'Produces correct analysis from relational data.', 'skill', 'must_have', 45, 'Queries, data modeling, and validation.', 0],
    ['seed-criterion-analyst-2', 'seed-rubric-analyst', 'Decision-ready reporting', 'Communicates metrics and tradeoffs clearly.', 'skill', 'must_have', 30, 'Reports connected to business decisions.', 1],
    ['seed-criterion-analyst-3', 'seed-rubric-analyst', 'Data quality', 'Finds and resolves unreliable data.', 'experience', 'preferred', 25, 'Audits, monitoring, or reconciliation.', 2],
  ];
  for (const criterion of criteria) add('rubric_criteria', ['id', 'organization_id', 'rubric_id', 'name', 'description', 'criterion_type', 'classification', 'weight', 'evidence_expectations', 'display_order'], [criterion[0], ORG_ID, ...criterion.slice(1)]);
  for (const [id, memberId, role] of [['seed-panel-recruiter', 'local-dev-membership', 'Recruiter'], ['seed-panel-manager', 'seed-member-manager', 'Hiring manager'], ['seed-panel-reviewer', 'seed-member-reviewer', 'Technical reviewer']]) {
    add('hiring_panel_members', ['id', 'organization_id', 'position_id', 'organization_member_id', 'panel_role'], [id, ORG_ID, 'seed-senior-backend-engineer', memberId, role]);
  }

  add('ingestion_runs', ['id', 'organization_id', 'position_id', 'source_type', 'status', 'total_count', 'completed_count', 'failed_count', 'created_by_id'], ['seed-ingestion-backend', ORG_ID, 'seed-senior-backend-engineer', 'cv_upload', 'completed', 6, 6, 0, ADMIN_ID]);
  const candidates = [
    ['priya-menon', 'Priya Menon', 'Backend Engineer at Razorpay', 'Bengaluru', 'reviewed', 'under_review'],
    ['arjun-nair', 'Arjun Nair', 'Senior Software Engineer at Freshworks', 'Chennai', 'reviewed', 'under_review'],
    ['kavya-iyer', 'Kavya Iyer', 'Platform Engineer at CRED', 'Bengaluru', 'reviewed', 'recruiter_screening'],
    ['rohan-mehta', 'Rohan Mehta', 'Software Engineer at Postman', 'Gurugram', 'needs_review', 'applied'],
    ['sana-khan', 'Sana Khan', 'Backend Developer at Meesho', 'Pune', 'reviewed', null],
    ['dev-patel', 'Dev Patel', 'Software Engineer at BrowserStack', 'Mumbai', 'unreviewed', null],
  ];
  for (const [id, name, headline, location, profileStatus, stage] of candidates) {
    add('candidates', ['id', 'organization_id', 'display_name', 'headline', 'location', 'profile_status'], [id, ORG_ID, name, headline, location, profileStatus]);
    add('candidate_sources', ['id', 'organization_id', 'candidate_id', 'ingestion_run_id', 'source_type', 'permission_method', 'status', 'source_label', 'imported_by_id', 'warnings'], [`seed-source-${id}`, ORG_ID, id, 'seed-ingestion-backend', id === 'kavya-iyer' ? 'referral' : 'cv_upload', 'recruiter_provided', 'parsed', `${name} — synthetic CV`, ADMIN_ID, json([])]);
    add('candidate_documents', ['id', 'organization_id', 'source_id', 'storage_key', 'original_filename', 'media_type', 'byte_size', 'checksum', 'page_count', 'malware_scan_status', 'malware_scan_provider', 'malware_scan_version', 'pdf_type', 'parsed_text_markdown', 'pages_needing_ocr', 'extractor', 'extractor_version', 'extraction_confidence', 'processing_time_ms'], [`seed-document-${id}`, ORG_ID, `seed-source-${id}`, `fixtures/candidates/${id}.pdf`, `${id}-synthetic-cv.pdf`, 'application/pdf', 1024, `synthetic-checksum-${id}`, 2, 'clean', 'sorted-fixture', 'fixture-v1', 'text', `# ${name}\nSynthetic CV fixture for local development.`, json([]), 'sorted-fixture', 'fixture-v2', 0.9, 0]);
    if (stage) add('applications', ['id', 'organization_id', 'candidate_id', 'position_id', 'stage', 'created_by_id'], [`seed-application-${id}`, ORG_ID, id, 'seed-senior-backend-engineer', stage, ADMIN_ID]);
  }
  const claims = [
    ['priya-menon', 'skill', 'PostgreSQL', 'Led schema and query tuning for payments services', 0.96],
    ['priya-menon', 'employment', 'Backend ownership', 'Operated services processing high-volume payment events', 0.93],
    ['arjun-nair', 'skill', 'Distributed systems', 'Designed event-driven services on AWS', 0.91],
    ['arjun-nair', 'employment', 'Technical leadership', 'Mentored four engineers and led design reviews', 0.88],
    ['kavya-iyer', 'skill', 'PostgreSQL', 'Owned database migrations for a platform service', 0.9],
    ['kavya-iyer', 'employment', 'Platform reliability', 'Improved service availability and observability', 0.94],
    ['rohan-mehta', 'skill', 'Node.js', 'Built TypeScript and Node.js APIs', 0.86],
    ['rohan-mehta', 'logistics', 'Notice period', 'Not stated in the supplied CV', 0.35],
  ];
  claims.forEach(([candidateId, type, label, value, confidence], index) => add('evidence_claims', ['id', 'organization_id', 'candidate_id', 'source_id', 'claim_type', 'label', 'claim_value', 'claim_status', 'page_number', 'section_label', 'excerpt', 'extractor_version', 'confidence', 'created_by_type'], [`seed-claim-${index + 1}`, ORG_ID, candidateId, `seed-source-${candidateId}`, type, label, value, type === 'logistics' ? 'unverified' : 'explicit', index % 2 + 1, type === 'skill' ? 'Skills' : 'Experience', value, 'deterministic-candidate-fixture-v2', confidence, 'model']));

  const evaluations = [
    ['priya-menon', 88, 91, 'strong_review'], ['arjun-nair', 84, 86, 'strong_review'], ['kavya-iyer', 82, 88, 'review'], ['rohan-mehta', 74, 68, 'needs_information'],
  ];
  for (const [candidateId, roleFit, confidence, recommendation] of evaluations) {
    add('candidate_evaluations', ['id', 'organization_id', 'candidate_id', 'position_id', 'rubric_id', 'rubric_version', 'state', 'role_fit', 'evidence_confidence', 'recommendation', 'evidence_snapshot', 'created_by_id'], [`seed-evaluation-${candidateId}`, ORG_ID, candidateId, 'seed-senior-backend-engineer', 'seed-rubric-backend', 1, 'evaluated', roleFit, confidence, recommendation, json({ sourceIds: [`seed-source-${candidateId}`], simulated: true }), ADMIN_ID]);
    [1, 2, 3].forEach((criterion, index) => add('criterion_evaluations', ['id', 'organization_id', 'candidate_evaluation_id', 'criterion_id', 'rating', 'score', 'evidence_confidence', 'reasoning', 'evidence_claim_ids', 'gaps'], [`seed-criterion-evaluation-${candidateId}-${criterion}`, ORG_ID, `seed-evaluation-${candidateId}`, `seed-criterion-backend-${criterion}`, Number(roleFit) >= 82 ? (index === 2 ? 'meets' : 'strong') : (index === 0 ? 'meets' : 'partial'), Math.max(55, Number(roleFit) - index * 6), Math.max(50, Number(confidence) - index * 5), 'Deterministic fixture evaluation based only on the seeded evidence snapshot.', json(candidateId === 'rohan-mehta' && index > 0 ? [] : [`seed-claim-${evaluations.findIndex((item) => item[0] === candidateId) * 2 + 1}`]), json(candidateId === 'rohan-mehta' ? ['Additional evidence requested'] : [])]));
  }

  add('review_assignments', ['id', 'organization_id', 'candidate_evaluation_id', 'reviewer_member_id', 'state', 'assigned_by_id'], ['seed-review-assignment-kavya', ORG_ID, 'seed-evaluation-kavya-iyer', 'seed-member-reviewer', 'submitted', ADMIN_ID]);
  add('panel_reviews', ['id', 'organization_id', 'assignment_id', 'candidate_evaluation_id', 'reviewer_member_id', 'recommendation', 'summary', 'criterion_feedback'], ['seed-panel-review-kavya', ORG_ID, 'seed-review-assignment-kavya', 'seed-evaluation-kavya-iyer', 'seed-member-reviewer', 'shortlist', 'Strong platform ownership with clear production evidence.', json({ simulated: false, note: 'Synthetic human-authored fixture' })]);
  add('review_comments', ['id', 'organization_id', 'candidate_evaluation_id', 'criterion_id', 'evidence_claim_id', 'author_member_id', 'body'], ['seed-review-comment-kavya', ORG_ID, 'seed-evaluation-kavya-iyer', 'seed-criterion-backend-1', 'seed-claim-6', 'seed-member-reviewer', 'Availability evidence is concrete; explore scale during recruiter screening.']);
  add('shortlist_decisions', ['id', 'organization_id', 'candidate_evaluation_id', 'candidate_id', 'position_id', 'decision', 'rationale', 'decided_by_id'], ['seed-shortlist-kavya', ORG_ID, 'seed-evaluation-kavya-iyer', 'kavya-iyer', 'seed-senior-backend-engineer', 'shortlisted', 'Human-approved shortlist based on panel review and evidence.', ADMIN_ID]);
  add('decision_events', ['id', 'organization_id', 'shortlist_decision_id', 'event_type', 'actor_user_id', 'metadata'], ['seed-decision-event-kavya', ORG_ID, 'seed-shortlist-kavya', 'shortlisted', ADMIN_ID, json({ source: 'synthetic_seed' })]);

  add('message_templates', ['id', 'organization_id', 'name', 'purpose', 'subject', 'body', 'version', 'created_by_id'], ['seed-template-shortlist', ORG_ID, 'Shortlist interest', 'shortlist_interest', 'Interest in the Senior Backend Engineer role', 'Would you like to continue to a recruiter screening conversation?', 1, ADMIN_ID]);
  add('outreach_threads', ['id', 'organization_id', 'candidate_id', 'application_id', 'position_id', 'purpose', 'status', 'requested_fields', 'created_by_id'], ['seed-thread-kavya', ORG_ID, 'kavya-iyer', 'seed-application-kavya-iyer', 'seed-senior-backend-engineer', 'shortlist_interest', 'replied', json(['interest', 'availability']), ADMIN_ID]);
  add('outreach_messages', ['id', 'organization_id', 'thread_id', 'direction', 'subject', 'body', 'status', 'approval_version', 'approved_by_id', 'approved_at', 'provider', 'provider_message_id', 'idempotency_key', 'sent_at'], ['seed-message-kavya', ORG_ID, 'seed-thread-kavya', 'outbound', 'Interest in the Senior Backend Engineer role', 'Hi Kavya, the panel would like to invite you to a recruiter screening conversation. Are you interested, and what times work for you?', 'sent', 1, ADMIN_ID, new Date('2026-08-04T09:00:00Z'), 'fixture', 'fixture-message-kavya', 'seed-outreach-kavya-v1', new Date('2026-08-04T09:01:00Z')]);
  add('delivery_events', ['id', 'organization_id', 'thread_id', 'message_id', 'provider_event_id', 'event_type', 'metadata'], ['seed-delivery-kavya', ORG_ID, 'seed-thread-kavya', 'seed-message-kavya', 'fixture-delivered-kavya', 'delivered', json({ simulated: true })]);
  add('candidate_responses', ['id', 'organization_id', 'thread_id', 'provider_event_id', 'body', 'parsed_suggestions'], ['seed-response-kavya', ORG_ID, 'seed-thread-kavya', 'fixture-reply-kavya', 'Yes, I am interested. Weekday afternoons work well.', json([{ field: 'interest', value: 'interested', confidence: 1 }, { field: 'availability', value: 'weekday afternoons', confidence: 0.98 }])]);
  add('pipeline_handoff_snapshots', ['id', 'organization_id', 'application_id', 'candidate_id', 'position_id', 'shortlist_decision_id', 'candidate_evaluation_id', 'rubric_id', 'rubric_version', 'evidence_snapshot', 'response_thread_id', 'rationale', 'advanced_by_id'], ['seed-handoff-kavya', ORG_ID, 'seed-application-kavya-iyer', 'kavya-iyer', 'seed-senior-backend-engineer', 'seed-shortlist-kavya', 'seed-evaluation-kavya-iyer', 'seed-rubric-backend', 1, json({ sourceIds: ['seed-source-kavya-iyer'], simulated: true }), 'seed-thread-kavya', 'Candidate confirmed interest; recruiter advanced the application.', ADMIN_ID]);
  add('pipeline_stage_transitions', ['id', 'organization_id', 'application_id', 'from_stage', 'to_stage', 'actor_user_id', 'rationale', 'snapshot_id'], ['seed-transition-kavya', ORG_ID, 'seed-application-kavya-iyer', 'shortlisted', 'recruiter_screening', ADMIN_ID, 'Candidate confirmed interest in the approved outreach thread.', 'seed-handoff-kavya']);
  add('candidate_communication_preferences', ['id', 'organization_id', 'candidate_id', 'channel', 'language_code', 'status', 'source', 'recorded_by_id'], ['seed-preference-kavya', ORG_ID, 'kavya-iyer', 'email', 'en-IN', 'opted_in', 'candidate_reply', ADMIN_ID]);
  add('notifications', ['id', 'organization_id', 'recipient_member_id', 'kind', 'subject_type', 'subject_id', 'body'], ['seed-notification-kavya', ORG_ID, 'local-dev-membership', 'candidate_replied', 'outreach_thread', 'seed-thread-kavya', 'Kavya Iyer replied and is ready for recruiter screening.']);
  add('audit_events', ['id', 'organization_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'metadata'], ['seed-audit-rubric-approved', ORG_ID, ADMIN_ID, 'rubric.approved', 'evaluation_rubric', 'seed-rubric-backend', json({ version: 1, synthetic: true })]);
  add('audit_events', ['id', 'organization_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'metadata'], ['seed-audit-shortlisted', ORG_ID, ADMIN_ID, 'candidate.shortlisted', 'shortlist_decision', 'seed-shortlist-kavya', json({ synthetic: true })]);
  add('audit_events', ['id', 'organization_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'metadata'], ['seed-audit-screening', ORG_ID, ADMIN_ID, 'application.stage_changed', 'application', 'seed-application-kavya-iyer', json({ from: 'shortlisted', to: 'recruiter_screening', synthetic: true })]);
  return result;
}

/** Seed a coherent, synthetic recruiting workflow. Existing rows are preserved. */
export async function seedDatabase(execute: QueryExecutor) {
  const seedRows = rows();
  for (const row of seedRows) {
    const columns = row.columns.join(', ');
    const placeholders = row.values.map((_, index) => `$${index + 1}`).join(', ');
    const conflict = row.table === 'users'
      ? 'ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash), name = EXCLUDED.name'
      : 'ON CONFLICT (id) DO NOTHING';
    await execute(`INSERT INTO ${row.table} (${columns}) VALUES (${placeholders}) ${conflict}`, row.values);
  }

  return { rows: seedRows.length, organizationId: ORG_ID };
}
