import { executeQuery } from '@/lib/db';
import { EXECUTION_TABLES_SQL } from './sql';
import type {
  RunEventLevel,
  RunEventType,
  RunStatus,
  StepError,
  StepKind,
  StepStatus,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowRunStep,
  WorkflowRunSummary,
} from './types';

/**
 * SQL persistence for workflow runs, steps and events, built on
 * executeQuery() so it works identically on PGlite (dev) and PostgreSQL.
 * No business rules live here — see service.ts and simulator.ts.
 */

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 12);
  return `${prefix}_${timestamp}${randomStr}`;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // TIMESTAMP columns come back without a zone; we always write UTC.
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
    return new Date(hasZone ? value : `${value}Z`);
  }
  throw new Error(`Cannot convert value to Date: ${String(value)}`);
}

function toNullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : toDate(value);
}

function toJsonObject<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

/* ----------------------------- schema -------------------------------- */

let schemaEnsured = false;

export async function ensureExecutionSchema(): Promise<void> {
  if (schemaEnsured) return;
  for (const statement of EXECUTION_TABLES_SQL.split(';')) {
    const sql = statement.trim();
    if (sql) await executeQuery(sql);
  }
  schemaEnsured = true;
}

/** Test helper: drop and recreate execution tables. */
export async function resetExecutionTables(): Promise<void> {
  await executeQuery('DROP TABLE IF EXISTS workflow_run_events');
  await executeQuery('DROP TABLE IF EXISTS workflow_run_steps');
  await executeQuery('DROP TABLE IF EXISTS workflow_runs');
  schemaEnsured = false;
  await ensureExecutionSchema();
}

/* ----------------------------- mappers ------------------------------- */

interface RunRow {
  id: string;
  run_number: number;
  workflow_id: string;
  workflow_name: string;
  trigger_summary: string;
  customer_name: string | null;
  conversation_id: string | null;
  status: string;
  status_reason: string | null;
  simulated: boolean;
  started_at: unknown;
  ended_at: unknown;
  updated_at: unknown;
}

interface StepRow {
  id: string;
  run_id: string;
  step_index: number;
  name: string;
  kind: string;
  actor: string | null;
  status: string;
  attempts: number;
  planned_duration_ms: number | null;
  elapsed_before_pause_ms: number | null;
  started_at: unknown;
  completed_at: unknown;
  summary: string | null;
  output: unknown;
  error: unknown;
}

interface EventRow {
  id: string;
  run_id: string;
  step_id: string | null;
  seq: number;
  event_type: string;
  level: string;
  title: string;
  description: string | null;
  metadata: unknown;
  created_at: unknown;
}

function rowToStep(row: StepRow): WorkflowRunStep {
  return {
    id: row.id,
    runId: row.run_id,
    index: row.step_index,
    name: row.name,
    kind: row.kind as StepKind,
    actor: row.actor,
    status: row.status as StepStatus,
    attempts: row.attempts,
    startedAt: toNullableDate(row.started_at),
    completedAt: toNullableDate(row.completed_at),
    summary: row.summary,
    output: toJsonObject<Record<string, unknown>>(row.output),
    error: toJsonObject<StepError>(row.error),
  };
}

function rowToRunBase(row: RunRow): Omit<WorkflowRun, 'steps'> {
  return {
    id: row.id,
    number: row.run_number,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    trigger: row.trigger_summary,
    customerName: row.customer_name,
    conversationId: row.conversation_id,
    status: row.status as RunStatus,
    statusReason: row.status_reason,
    simulated: Boolean(row.simulated),
    startedAt: toDate(row.started_at),
    endedAt: toNullableDate(row.ended_at),
    updatedAt: toDate(row.updated_at),
  };
}

function rowToEvent(row: EventRow): WorkflowRunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    seq: row.seq,
    type: row.event_type as RunEventType,
    level: row.level as RunEventLevel,
    title: row.title,
    description: row.description,
    metadata: toJsonObject<Record<string, unknown>>(row.metadata),
    at: toDate(row.created_at),
  };
}

/* ------------------------------ reads -------------------------------- */

export async function getRunRecord(runId: string): Promise<WorkflowRun | null> {
  const runs = await executeQuery<RunRow>('SELECT * FROM workflow_runs WHERE id = $1', [runId]);
  if (runs.length === 0) return null;

  const steps = await executeQuery<StepRow>(
    'SELECT * FROM workflow_run_steps WHERE run_id = $1 ORDER BY step_index ASC',
    [runId],
  );

  return { ...rowToRunBase(runs[0]), steps: steps.map(rowToStep) };
}

export async function listRunRecords(options?: {
  status?: RunStatus;
  limit?: number;
}): Promise<WorkflowRunSummary[]> {
  const limit = options?.limit ?? 50;
  const params: unknown[] = [];
  let where = '';

  if (options?.status) {
    params.push(options.status);
    where = `WHERE r.status = $${params.length}`;
  }

  params.push(limit);

  const rows = await executeQuery<
    RunRow & { step_count: number; completed_step_count: number; current_step_name: string | null }
  >(
    `SELECT r.*,
            (SELECT COUNT(*)::int FROM workflow_run_steps s WHERE s.run_id = r.id) AS step_count,
            (SELECT COUNT(*)::int FROM workflow_run_steps s
              WHERE s.run_id = r.id AND s.status = 'completed') AS completed_step_count,
            (SELECT s.name FROM workflow_run_steps s
              WHERE s.run_id = r.id AND s.status IN ('running', 'waiting', 'failed')
              ORDER BY s.step_index ASC LIMIT 1) AS current_step_name
     FROM workflow_runs r
     ${where}
     ORDER BY r.started_at DESC
     LIMIT $${params.length}`,
    params as never[],
  );

  return rows.map((row) => ({
    ...rowToRunBase(row),
    stepCount: row.step_count,
    completedStepCount: row.completed_step_count,
    currentStepName: row.current_step_name,
  }));
}

export async function listRunEvents(runId: string): Promise<WorkflowRunEvent[]> {
  const rows = await executeQuery<EventRow>(
    'SELECT * FROM workflow_run_events WHERE run_id = $1 ORDER BY seq ASC',
    [runId],
  );
  return rows.map(rowToEvent);
}

export async function countRuns(): Promise<number> {
  const rows = await executeQuery<{ count: number | string }>(
    'SELECT COUNT(*)::int AS count FROM workflow_runs',
  );
  return Number(rows[0]?.count ?? 0);
}

/** Run numbers continue after the seeded history (#1038…). */
export async function nextRunNumber(): Promise<number> {
  const rows = await executeQuery<{ max: number | string | null }>(
    'SELECT MAX(run_number) AS max FROM workflow_runs',
  );
  const max = rows[0]?.max;
  return (max === null || max === undefined ? 1037 : Number(max)) + 1;
}

/* ------------------------------ writes ------------------------------- */

export interface NewRunRecord {
  id?: string;
  runNumber: number;
  workflowId: string;
  workflowName: string;
  trigger: string;
  customerName: string | null;
  conversationId: string | null;
  status: RunStatus;
  startedAt: Date;
  steps: Array<{
    name: string;
    kind: StepKind;
    actor: string | null;
    plannedDurationMs: number;
  }>;
}

export async function insertRunRecord(record: NewRunRecord): Promise<string> {
  const runId = record.id ?? generateId('run');

  await executeQuery(
    `INSERT INTO workflow_runs (
       id, run_number, workflow_id, workflow_name, trigger_summary,
       customer_name, conversation_id, status, simulated, started_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $9)`,
    [
      runId,
      record.runNumber,
      record.workflowId,
      record.workflowName,
      record.trigger,
      record.customerName,
      record.conversationId,
      record.status,
      record.startedAt.toISOString(),
    ],
  );

  for (const [index, step] of record.steps.entries()) {
    await executeQuery(
      `INSERT INTO workflow_run_steps (
         id, run_id, step_index, name, kind, actor, status, attempts, planned_duration_ms
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, $7)`,
      [generateId('step'), runId, index, step.name, step.kind, step.actor, step.plannedDurationMs],
    );
  }

  return runId;
}

export interface RunPatch {
  status?: RunStatus;
  statusReason?: string | null;
  endedAt?: Date | null;
}

export async function updateRunRecord(runId: string, patch: RunPatch, updatedAt: Date): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.status !== undefined) add('status', patch.status);
  if (patch.statusReason !== undefined) add('status_reason', patch.statusReason);
  if (patch.endedAt !== undefined) add('ended_at', patch.endedAt ? patch.endedAt.toISOString() : null);
  add('updated_at', updatedAt.toISOString());

  params.push(runId);
  await executeQuery(
    `UPDATE workflow_runs SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params as never[],
  );
}

export interface StepPatch {
  status?: StepStatus;
  attempts?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  elapsedBeforePauseMs?: number | null;
  summary?: string | null;
  output?: Record<string, unknown> | null;
  error?: StepError | null;
}

export async function updateStepRecord(stepId: string, patch: StepPatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.status !== undefined) add('status', patch.status);
  if (patch.attempts !== undefined) add('attempts', patch.attempts);
  if (patch.startedAt !== undefined) add('started_at', patch.startedAt ? patch.startedAt.toISOString() : null);
  if (patch.completedAt !== undefined)
    add('completed_at', patch.completedAt ? patch.completedAt.toISOString() : null);
  if (patch.elapsedBeforePauseMs !== undefined) add('elapsed_before_pause_ms', patch.elapsedBeforePauseMs);
  if (patch.summary !== undefined) add('summary', patch.summary);
  if (patch.output !== undefined) add('output', patch.output ? JSON.stringify(patch.output) : null);
  if (patch.error !== undefined) add('error', patch.error ? JSON.stringify(patch.error) : null);

  if (sets.length === 0) return;

  params.push(stepId);
  await executeQuery(
    `UPDATE workflow_run_steps SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params as never[],
  );
}

export interface NewRunEvent {
  runId: string;
  stepId?: string | null;
  type: RunEventType;
  level?: RunEventLevel;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  at: Date;
}

export async function appendRunEvent(event: NewRunEvent): Promise<void> {
  const seqRows = await executeQuery<{ next: number | string }>(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM workflow_run_events WHERE run_id = $1',
    [event.runId],
  );
  const seq = Number(seqRows[0]?.next ?? 1);

  await executeQuery(
    `INSERT INTO workflow_run_events (
       id, run_id, step_id, seq, event_type, level, title, description, metadata, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      generateId('evt'),
      event.runId,
      event.stepId ?? null,
      seq,
      event.type,
      event.level ?? 'info',
      event.title,
      event.description ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.at.toISOString(),
    ],
  );
}

/** Read a fresh copy of the elapsed-before-pause bookkeeping column. */
export async function getStepElapsedBeforePause(stepId: string): Promise<number | null> {
  const rows = await executeQuery<{ elapsed_before_pause_ms: number | null }>(
    'SELECT elapsed_before_pause_ms FROM workflow_run_steps WHERE id = $1',
    [stepId],
  );
  return rows[0]?.elapsed_before_pause_ms ?? null;
}
