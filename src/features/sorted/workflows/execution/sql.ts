/**
 * DDL for workflow execution tables.
 *
 * Shared by the lazy dev bootstrap (store.ts) and `scripts/init-db.ts` so the
 * two cannot drift. Keep it compatible with both PGlite and PostgreSQL, and
 * keep `prisma/schema.prisma` in sync (Prisma documents the schema; raw SQL
 * through executeQuery() is the application data-access interface).
 *
 * Timestamps are TIMESTAMPTZ on purpose: PGlite parses naive TIMESTAMP
 * values in the server's local timezone on read, which skews instants on
 * non-UTC machines. TIMESTAMPTZ round-trips instants correctly everywhere.
 */
export const EXECUTION_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    run_number INTEGER NOT NULL,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    trigger_summary TEXT NOT NULL,
    customer_name TEXT,
    conversation_id TEXT,
    status TEXT NOT NULL,
    status_reason TEXT,
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status, started_at);
  CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs (workflow_id, started_at);

  CREATE TABLE IF NOT EXISTS workflow_run_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    actor TEXT,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    planned_duration_ms INTEGER,
    elapsed_before_pause_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    summary TEXT,
    output JSON,
    error JSON
  );

  CREATE INDEX IF NOT EXISTS workflow_run_steps_run_idx ON workflow_run_steps (run_id, step_index);

  CREATE TABLE IF NOT EXISTS workflow_run_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_id TEXT,
    seq INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    description TEXT,
    metadata JSON,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS workflow_run_events_run_idx ON workflow_run_events (run_id, seq);
`;
