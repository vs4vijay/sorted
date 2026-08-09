import { WORKSPACE_OWNER } from './auth';
import { SEED_SCENARIOS } from './fixtures';
import { advanceRun } from './simulator';
import { canApplyAction, RUN_ACTION_META, RUN_STATUS_META } from './state';
import { templateForWorkflow, type WorkflowTemplate } from './templates';
import {
  appendRunEvent,
  countRuns,
  ensureExecutionSchema,
  getRunRecord,
  getStepElapsedBeforePause,
  insertRunRecord,
  listRunEvents,
  listRunRecords,
  nextRunNumber,
  updateRunRecord,
  updateStepRecord,
} from './store';
import type {
  ActionResult,
  ExecutionActor,
  RunActionInput,
  WorkflowRun,
  WorkflowRunEvent,
  WorkflowRunStep,
  WorkflowRunSummary,
} from './types';

/**
 * Workflow execution service — the only entry point the UI and server
 * actions use. Responsibilities:
 *
 *  - bootstrap schema + seeded demo history on first use (dev convenience)
 *  - advance live runs through the simulated executor on every read
 *  - guard owner actions against illegal state transitions (server-side)
 *  - append an auditable event for everything that happens
 */

/* --------------------------- bootstrapping ---------------------------- */

let readyPromise: Promise<void> | null = null;

export function ensureExecutionReady(now: Date = new Date()): Promise<void> {
  if (!readyPromise) {
    readyPromise = prepare(now).catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

/** Test hook: skip demo seeding so tests fully control the data. */
export function markExecutionReadyForTests(): void {
  readyPromise = Promise.resolve();
}

async function prepare(now: Date): Promise<void> {
  await ensureExecutionSchema();
  if ((await countRuns()) === 0) {
    await seedDemoRuns(now);
  }
}

/**
 * Seeds replay the real service functions with historical clocks, so demo
 * runs are structurally identical to live ones.
 */
async function seedDemoRuns(now: Date): Promise<void> {
  for (const scenario of SEED_SCENARIOS) {
    const template = templateForWorkflow(scenario.workflowId);
    if (!template) continue;

    const startedAt = new Date(now.getTime() - scenario.startedAgoMs);
    await createRunInternal({
      id: scenario.runId,
      template,
      customerName: scenario.customerName,
      conversationId: scenario.conversationId,
      startedAt,
    });

    for (const item of scenario.script) {
      const at = new Date(startedAt.getTime() + item.atOffsetMs);
      if (item.do === 'advance') {
        const run = await getRunRecord(scenario.runId);
        if (run) await advanceRun(run, at);
      } else {
        await performAction(
          { runId: scenario.runId, action: item.action, note: item.note },
          WORKSPACE_OWNER,
          at,
        );
      }
    }
  }
}

/* ---------------------------- run locking ----------------------------- */

/**
 * Serializes advancement/actions per run within this server process so a
 * poll refresh and a button click cannot interleave their writes. A real
 * multi-instance executor must move this into the database
 * (SELECT … FOR UPDATE); see the integration notes.
 */
const runLockTails = new Map<string, Promise<unknown>>();

function withRunLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const tail = runLockTails.get(runId) ?? Promise.resolve();
  const result = tail.then(fn, fn);
  const settled = result.catch(() => {});
  runLockTails.set(runId, settled);
  void settled.then(() => {
    if (runLockTails.get(runId) === settled) runLockTails.delete(runId);
  });
  return result;
}

/* ------------------------------- reads -------------------------------- */

export interface RunDetail {
  run: WorkflowRun;
  events: WorkflowRunEvent[];
}

export async function getRun(
  runId: string,
  options?: { now?: Date },
): Promise<RunDetail | null> {
  await ensureExecutionReady();

  return withRunLock(runId, async () => {
    let run = await getRunRecord(runId);
    if (!run) return null;

    if (RUN_STATUS_META[run.status].isLive) {
      const changed = await advanceRun(run, options?.now ?? new Date());
      if (changed) run = (await getRunRecord(runId)) ?? run;
    }

    const events = await listRunEvents(runId);
    return { run, events };
  });
}

export async function listRuns(options?: { now?: Date; limit?: number }): Promise<WorkflowRunSummary[]> {
  await ensureExecutionReady();
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 100;

  const summaries = await listRunRecords({ limit });
  const live = summaries.filter((summary) => RUN_STATUS_META[summary.status].isLive);

  for (const summary of live) {
    await withRunLock(summary.id, async () => {
      const run = await getRunRecord(summary.id);
      if (run && RUN_STATUS_META[run.status].isLive) {
        await advanceRun(run, now);
      }
    });
  }

  return live.length > 0 ? listRunRecords({ limit }) : summaries;
}

/* ------------------------------ creation ------------------------------ */

interface CreateRunOptions {
  workflowId: string;
  customerName?: string | null;
  conversationId?: string | null;
  id?: string;
  now?: Date;
}

export async function createRun(options: CreateRunOptions): Promise<ActionResult> {
  await ensureExecutionReady();

  const template = templateForWorkflow(options.workflowId);
  if (!template) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown workflow.' },
    };
  }

  const startedAt = options.now ?? new Date();
  const runId = await createRunInternal({
    id: options.id,
    template,
    customerName: options.customerName ?? null,
    conversationId: options.conversationId ?? null,
    startedAt,
  });

  const run = await getRunRecord(runId);
  if (run) await advanceRun(run, startedAt);

  const started = await getRunRecord(runId);
  return {
    ok: true,
    runId,
    status: started?.status ?? 'running',
    message: `Run #${started?.number ?? ''} started for ${options.customerName ?? 'the customer'}.`,
  };
}

async function createRunInternal(options: {
  id?: string;
  template: WorkflowTemplate;
  customerName: string | null;
  conversationId: string | null;
  startedAt: Date;
}): Promise<string> {
  const runNumber = await nextRunNumber();

  const runId = await insertRunRecord({
    id: options.id,
    runNumber,
    workflowId: options.template.id,
    workflowName: options.template.name,
    trigger: options.template.trigger,
    customerName: options.customerName,
    conversationId: options.conversationId,
    status: 'queued',
    startedAt: options.startedAt,
    steps: options.template.steps.map((step) => ({
      name: step.name,
      kind: step.kind,
      actor: step.actor,
      plannedDurationMs: step.plannedDurationMs,
    })),
  });

  await appendRunEvent({
    runId,
    type: 'run_queued',
    level: 'info',
    title: 'Run created',
    description: options.customerName
      ? `${options.template.name} for ${options.customerName}`
      : options.template.name,
    metadata: { simulated: true, run_id: runId, workflow_id: options.template.id },
    at: options.startedAt,
  });

  return runId;
}

/* ------------------------------ actions ------------------------------- */

export async function applyRunAction(
  input: RunActionInput,
  actor: ExecutionActor,
  now: Date = new Date(),
): Promise<ActionResult> {
  await ensureExecutionReady();
  return withRunLock(input.runId, () => performAction(input, actor, now));
}

/** Must be called with the run lock held (or from seeding). */
async function performAction(
  input: RunActionInput,
  actor: ExecutionActor,
  now: Date,
): Promise<ActionResult> {
  let run = await getRunRecord(input.runId);
  if (!run) {
    return { ok: false, error: { code: 'RUN_NOT_FOUND', message: 'This run does not exist.' } };
  }

  // Bring the run up to date first: it may have progressed past the state
  // the user was looking at (e.g. running → waiting for approval).
  if (RUN_STATUS_META[run.status].isLive) {
    const changed = await advanceRun(run, now);
    if (changed) run = (await getRunRecord(input.runId)) ?? run;
  }

  if (!canApplyAction(run.status, input.action)) {
    const statusLabel = RUN_STATUS_META[run.status].label.toLowerCase();
    const actionLabel = RUN_ACTION_META[input.action].label;
    return {
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: `“${actionLabel}” is not available — this run is now ${statusLabel}.`,
      },
    };
  }

  switch (input.action) {
    case 'approve':
      return approveRun(run, actor, now, input.note);
    case 'reject':
      return rejectRun(run, actor, now, input.note);
    case 'retry':
      return retryRun(run, actor, now);
    case 'pause':
      return pauseRun(run, actor, now);
    case 'resume':
      return resumeRun(run, actor, now);
    case 'cancel':
      return cancelRun(run, actor, now, input.note);
    case 'provide_input':
      return provideInput(run, actor, now, input.note);
    case 'run_again':
      return runAgain(run, now);
  }
}

function waitingStep(run: WorkflowRun): WorkflowRunStep | null {
  return run.steps.find((step) => step.status === 'waiting') ?? null;
}

async function approveRun(
  run: WorkflowRun,
  actor: ExecutionActor,
  now: Date,
  note?: string,
): Promise<ActionResult> {
  const step = waitingStep(run);
  if (!step) {
    return { ok: false, error: { code: 'INTERNAL', message: 'No step is waiting for approval.' } };
  }

  await updateStepRecord(step.id, {
    status: 'completed',
    completedAt: now,
    summary: `Approved by ${actor.name}`,
  });
  await appendRunEvent({
    runId: run.id,
    stepId: step.id,
    type: 'approval_granted',
    level: 'success',
    title: `Approved by ${actor.name}`,
    description: note ?? null,
    metadata: { run_id: run.id, step_id: step.id, actor_id: actor.id },
    at: now,
  });
  await updateRunRecord(run.id, { status: 'running', statusReason: null }, now);

  const fresh = await getRunRecord(run.id);
  if (fresh) await advanceRun(fresh, now);

  return {
    ok: true,
    runId: run.id,
    status: 'running',
    message: 'Approved — Sorted is continuing the workflow.',
  };
}

async function rejectRun(
  run: WorkflowRun,
  actor: ExecutionActor,
  now: Date,
  note?: string,
): Promise<ActionResult> {
  const step = waitingStep(run);
  if (!step) {
    return { ok: false, error: { code: 'INTERNAL', message: 'No step is waiting for approval.' } };
  }

  await updateStepRecord(step.id, {
    status: 'cancelled',
    completedAt: now,
    summary: note ? `Rejected by ${actor.name} — ${note}` : `Rejected by ${actor.name}`,
  });
  await appendRunEvent({
    runId: run.id,
    stepId: step.id,
    type: 'approval_rejected',
    level: 'warning',
    title: `Rejected by ${actor.name}`,
    description: note ?? null,
    metadata: { run_id: run.id, step_id: step.id, actor_id: actor.id },
    at: now,
  });

  await skipPendingSteps(run);
  await updateRunRecord(
    run.id,
    {
      status: 'cancelled',
      statusReason: note ? `Rejected — ${note}` : `Rejected by ${actor.name}`,
      endedAt: now,
    },
    now,
  );
  await appendRunEvent({
    runId: run.id,
    type: 'run_cancelled',
    level: 'warning',
    title: 'Run stopped',
    description: 'The drafted response was rejected and will not be sent.',
    metadata: { run_id: run.id, actor_id: actor.id },
    at: now,
  });

  return {
    ok: true,
    runId: run.id,
    status: 'cancelled',
    message: 'Rejected — nothing was sent to the customer.',
  };
}

async function retryRun(run: WorkflowRun, actor: ExecutionActor, now: Date): Promise<ActionResult> {
  const step = run.steps.find((candidate) => candidate.status === 'failed');
  if (!step) {
    return { ok: false, error: { code: 'INTERNAL', message: 'No failed step to retry.' } };
  }

  await updateStepRecord(step.id, {
    status: 'running',
    startedAt: now,
    completedAt: null,
    attempts: step.attempts + 1,
    error: null,
  });
  await appendRunEvent({
    runId: run.id,
    stepId: step.id,
    type: 'step_retried',
    level: 'info',
    title: `Retrying: ${step.name}`,
    description: `Attempt ${step.attempts + 1}, requested by ${actor.name}`,
    metadata: { run_id: run.id, step_id: step.id, attempt: step.attempts + 1, actor_id: actor.id },
    at: now,
  });
  await updateRunRecord(run.id, { status: 'running', statusReason: null }, now);

  const fresh = await getRunRecord(run.id);
  if (fresh) await advanceRun(fresh, now);

  return { ok: true, runId: run.id, status: 'running', message: `Retrying “${step.name}”…` };
}

async function pauseRun(run: WorkflowRun, actor: ExecutionActor, now: Date): Promise<ActionResult> {
  const step = run.steps.find((candidate) => candidate.status === 'running');

  if (step && step.startedAt) {
    const elapsed = Math.max(0, now.getTime() - step.startedAt.getTime());
    await updateStepRecord(step.id, { status: 'waiting', elapsedBeforePauseMs: elapsed });
  }

  await updateRunRecord(run.id, { status: 'paused' }, now);
  await appendRunEvent({
    runId: run.id,
    stepId: step?.id ?? null,
    type: 'run_paused',
    level: 'info',
    title: 'Run paused',
    description: `Paused by ${actor.name}`,
    metadata: { run_id: run.id, actor_id: actor.id },
    at: now,
  });

  return { ok: true, runId: run.id, status: 'paused', message: 'Run paused.' };
}

async function resumeRun(run: WorkflowRun, actor: ExecutionActor, now: Date): Promise<ActionResult> {
  const step = waitingStep(run);

  if (step) {
    const elapsed = (await getStepElapsedBeforePause(step.id)) ?? 0;
    await updateStepRecord(step.id, {
      status: 'running',
      startedAt: new Date(now.getTime() - elapsed),
      elapsedBeforePauseMs: null,
    });
  }

  await updateRunRecord(run.id, { status: 'running' }, now);
  await appendRunEvent({
    runId: run.id,
    stepId: step?.id ?? null,
    type: 'run_resumed',
    level: 'info',
    title: 'Run resumed',
    description: `Resumed by ${actor.name}`,
    metadata: { run_id: run.id, actor_id: actor.id },
    at: now,
  });

  const fresh = await getRunRecord(run.id);
  if (fresh) await advanceRun(fresh, now);

  return { ok: true, runId: run.id, status: 'running', message: 'Run resumed.' };
}

async function cancelRun(
  run: WorkflowRun,
  actor: ExecutionActor,
  now: Date,
  note?: string,
): Promise<ActionResult> {
  const active = run.steps.find(
    (candidate) => candidate.status === 'running' || candidate.status === 'waiting',
  );
  if (active) {
    await updateStepRecord(active.id, { status: 'cancelled', completedAt: now });
  }

  await skipPendingSteps(run);
  await updateRunRecord(
    run.id,
    { status: 'cancelled', statusReason: note ?? `Cancelled by ${actor.name}`, endedAt: now },
    now,
  );
  await appendRunEvent({
    runId: run.id,
    type: 'run_cancelled',
    level: 'warning',
    title: 'Run cancelled',
    description: note ? `${note} (by ${actor.name})` : `Cancelled by ${actor.name}`,
    metadata: { run_id: run.id, actor_id: actor.id },
    at: now,
  });

  return { ok: true, runId: run.id, status: 'cancelled', message: 'Run cancelled.' };
}

async function provideInput(
  run: WorkflowRun,
  actor: ExecutionActor,
  now: Date,
  note?: string,
): Promise<ActionResult> {
  const step = waitingStep(run);
  if (!step) {
    return { ok: false, error: { code: 'INTERNAL', message: 'No step is waiting for input.' } };
  }

  await updateStepRecord(step.id, {
    status: 'completed',
    completedAt: now,
    summary: note ? `Reply recorded: “${note}”` : 'Customer reply recorded manually',
  });
  await appendRunEvent({
    runId: run.id,
    stepId: step.id,
    type: 'input_received',
    level: 'success',
    title: 'Customer reply recorded',
    description: note ?? `Recorded manually by ${actor.name}`,
    metadata: { run_id: run.id, step_id: step.id, actor_id: actor.id },
    at: now,
  });
  await updateRunRecord(run.id, { status: 'running', statusReason: null }, now);

  const fresh = await getRunRecord(run.id);
  if (fresh) await advanceRun(fresh, now);

  return { ok: true, runId: run.id, status: 'running', message: 'Reply recorded — continuing.' };
}

async function runAgain(run: WorkflowRun, now: Date): Promise<ActionResult> {
  const template = templateForWorkflow(run.workflowId);
  if (!template) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'This workflow can no longer be run.' },
    };
  }

  const runId = await createRunInternal({
    template,
    customerName: run.customerName,
    conversationId: run.conversationId,
    startedAt: now,
  });

  const created = await getRunRecord(runId);
  if (created) await advanceRun(created, now);

  const started = await getRunRecord(runId);
  return {
    ok: true,
    runId,
    status: started?.status ?? 'running',
    message: `Run #${started?.number ?? ''} started.`,
  };
}

async function skipPendingSteps(run: WorkflowRun): Promise<void> {
  for (const step of run.steps) {
    if (step.status === 'pending') {
      await updateStepRecord(step.id, { status: 'skipped' });
    }
  }
}
