#!/usr/bin/env bun
import { PGlite } from '@electric-sql/pglite';
const url = process.env.DATABASE_URL;
if (!url?.startsWith('file:/tmp/sorted-'))
  throw new Error(
    'This synthetic validation seed only runs against a /tmp/sorted-* PGlite database.',
  );
const db = new PGlite(url.slice(5));
await db.waitReady;
const org = (
  await db.query<{ id: string }>('SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1')
).rows[0];
const user = (
  await db.query<{ id: string }>('SELECT id FROM users ORDER BY created_at DESC LIMIT 1')
).rows[0];
if (!org || !user) throw new Error('Create a local workspace first.');
const candidate = crypto.randomUUID(),
  run = crypto.randomUUID(),
  source = crypto.randomUUID();
await db.query(
  "INSERT INTO candidates(id,organization_id,display_name,headline,location,profile_status) VALUES($1,$2,'Aarav Mehta','Senior Backend Engineer','Bengaluru','unreviewed')",
  [candidate, org.id],
);
await db.query(
  "INSERT INTO ingestion_runs(id,organization_id,source_type,status,total_count,completed_count,created_by_id) VALUES($1,$2,'cv_batch','completed',1,1,$3)",
  [run, org.id, user.id],
);
await db.query(
  "INSERT INTO candidate_sources(id,organization_id,candidate_id,ingestion_run_id,source_type,permission_method,status,source_label,imported_by_id) VALUES($1,$2,$3,$4,'cv_upload','recruiter_provided','parsed','aarav-mehta-synthetic-cv.pdf',$5)",
  [source, org.id, candidate, run, user.id],
);
for (const [type, label, value, section, excerpt, confidence] of [
  [
    'employment',
    'Employment evidence',
    'Senior Backend Engineer at FinEdge Labs (2021–present)',
    'Experience',
    'Designed event-driven payment services processing high-volume transactions.',
    0.92,
  ],
  [
    'skill',
    'Skill',
    'PostgreSQL',
    'Skills',
    'PostgreSQL performance tuning, indexing, and query planning.',
    0.94,
  ],
  [
    'skill',
    'Skill',
    'Kafka',
    'Skills',
    'Built Kafka-based event processing and reconciliation workflows.',
    0.88,
  ],
  [
    'project',
    'Project evidence',
    'Payment reconciliation platform',
    'Projects',
    'Designed a payment reconciliation platform with idempotent consumers.',
    0.86,
  ],
  [
    'education',
    'Education',
    'B.Tech in Computer Science',
    'Education',
    'B.Tech in Computer Science, National Institute of Technology.',
    0.9,
  ],
] as const)
  await db.query(
    "INSERT INTO evidence_claims(id,organization_id,candidate_id,source_id,claim_type,label,claim_value,claim_status,section_label,excerpt,extractor_version,confidence,created_by_type) VALUES($1,$2,$3,$4,$5,$6,$7,'explicit',$8,$9,'synthetic-demo.v1',$10,'model')",
    [
      crypto.randomUUID(),
      org.id,
      candidate,
      source,
      type,
      label,
      value,
      section,
      excerpt,
      confidence,
    ],
  );
console.log(candidate);
await db.close();
