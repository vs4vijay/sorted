process.env.DATABASE_URL = 'file:memory://';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { WORKSPACE_OWNER } from '../auth';
import {
  applyRunAction,
  createRun,
  getRun,
  listRuns,
  markExecutionReadyForTests,
} from '../service';
import { resetExecutionTables } from '../store';
import type { ActionResult } from '../types';

/**
 * Integration tests for the execution service against an in-memory PGlite
 * database. Time is injected everywhere, so the simulated executor advances
 * deterministically without sleeping.
 */

const t0 = new Date('2026-08-09T10:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

function unwrap(result: ActionResult): Extract<ActionResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok result, got: ${result.error.message}`);
  return result;
}

async function startQuoteRun(): Promise<string> {
  const result = unwrap(
    await createRun({
      workflowId: 'wf_quote_collector',
      customerName: 'Rahul Sharma',
      conversationId: 'conv_rahul',
      now: t0,
    }),
  );
  return result.runId;
}

beforeAll(() => {
  markExecutionReadyForTests();
});

beforeEach(async () => {
  await resetExecutionTables();
});

afterAll(async () => {
  // Shut PGlite down so the test process can exit cleanly.
  await (globalThis as typeof globalThis & { pglite?: { close(): Promise<void> } }).pglite?.close();
});

describe('run lifecycle', () => {
  test('creating a run starts its first step and logs the start', async () => {
    const runId = await startQuoteRun();
    const detail = await getRun(runId, { now: t0 });

    expect(detail).not.toBeNull();
    expect(detail!.run.status).toBe('running');
    expect(detail!.run.number).toBe(1038);
    expect(detail!.run.simulated).toBe(true);
    expect(detail!.run.steps[0].status).toBe('running');

    const types = detail!.events.map((event) => event.type);
    expect(types).toContain('run_queued');
    expect(types).toContain('run_started');
    expect(types).toContain('step_started');
  });

  test('steps complete as simulated time elapses', async () => {
    const runId = await startQuoteRun();
    // Quote template durations: 400, 1300, 1200, 600, 1500ms.
    const detail = await getRun(runId, { now: at(3000) });

    const statuses = detail!.run.steps.map((step) => step.status);
    expect(statuses.slice(0, 3)).toEqual(['completed', 'completed', 'completed']);
    expect(statuses[3]).toBe('running');
    expect(detail!.run.steps[0].summary).not.toBeNull();
  });

  test('the run stops at the approval step and waits', async () => {
    const runId = await startQuoteRun();
    const detail = await getRun(runId, { now: at(6000) });

    expect(detail!.run.status).toBe('waiting_approval');
    expect(detail!.run.steps[5].status).toBe('waiting');
    expect(detail!.run.steps[6].status).toBe('pending');
    expect(detail!.events.map((event) => event.type)).toContain('approval_requested');
  });

  test('the visualization state matches step states after failure', async () => {
    const result = unwrap(
      await createRun({ workflowId: 'wf_complaint_recovery', customerName: 'Ahmed Khan', now: t0 }),
    );
    // Complaint template: 300 + 1200 + 1500ms → third step fails at 3000ms.
    const detail = await getRun(result.runId, { now: at(4000) });

    expect(detail!.run.status).toBe('failed');
    const statuses = detail!.run.steps.map((step) => step.status);
    expect(statuses).toEqual(['completed', 'completed', 'failed', 'pending', 'pending']);
  });
});

describe('approval', () => {
  test('approve completes the approval step and finishes the run', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });

    const result = await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_000));
    expect(unwrap(result).status).toBe('running');

    // Send step takes 1400ms after approval.
    const detail = await getRun(runId, { now: at(61_500) });
    expect(detail!.run.status).toBe('completed');
    expect(detail!.run.endedAt).not.toBeNull();
    expect(detail!.run.steps[5].summary).toBe(`Approved by ${WORKSPACE_OWNER.name}`);
    expect(detail!.run.steps[6].status).toBe('completed');

    const types = detail!.events.map((event) => event.type);
    expect(types).toContain('approval_granted');
    expect(types).toContain('run_completed');
  });

  test('completing the send step records declared side effects as simulated', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });
    await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_000));

    const detail = await getRun(runId, { now: at(61_500) });
    const sendStep = detail!.run.steps[6];
    expect(sendStep.status).toBe('completed');

    const effects = sendStep.output?.side_effects as Array<{ kind: string; status: string }>;
    expect(Array.isArray(effects)).toBe(true);
    expect(effects.map((effect) => effect.kind)).toEqual(['whatsapp_message', 'voice_note']);
    // Honesty rule: the simulated executor must never claim real delivery.
    for (const effect of effects) {
      expect(effect.status).toBe('simulated');
    }
  });

  test('a duplicate approve is rejected as an invalid transition', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });

    await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_000));
    const second = await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_100));

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('INVALID_TRANSITION');
  });

  test('reject stops the run without sending anything', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });

    const result = await applyRunAction(
      { runId, action: 'reject', note: 'Wrong pricing' },
      WORKSPACE_OWNER,
      at(30_000),
    );
    expect(unwrap(result).status).toBe('cancelled');

    const detail = await getRun(runId, { now: at(31_000) });
    expect(detail!.run.status).toBe('cancelled');
    expect(detail!.run.statusReason).toContain('Wrong pricing');
    expect(detail!.run.steps[5].status).toBe('cancelled');
    expect(detail!.run.steps[6].status).toBe('skipped');
    expect(detail!.events.map((event) => event.type)).toContain('approval_rejected');
  });
});

describe('failure and retry', () => {
  test('a scripted failure surfaces a typed, retryable error', async () => {
    const result = unwrap(
      await createRun({ workflowId: 'wf_complaint_recovery', customerName: 'Ahmed Khan', now: t0 }),
    );
    const detail = await getRun(result.runId, { now: at(4000) });

    expect(detail!.run.status).toBe('failed');
    const failed = detail!.run.steps[2];
    expect(failed.error?.code).toBe('AI_RESPONSE_GENERATION_FAILED');
    expect(failed.error?.retryable).toBe(true);
    expect(detail!.run.statusReason).toBe(failed.error!.message);
    expect(detail!.events.map((event) => event.type)).toContain('run_failed');
  });

  test('retry re-runs the failed step and the run continues to approval', async () => {
    const result = unwrap(
      await createRun({ workflowId: 'wf_complaint_recovery', customerName: 'Ahmed Khan', now: t0 }),
    );
    await getRun(result.runId, { now: at(4000) });

    const retried = await applyRunAction(
      { runId: result.runId, action: 'retry' },
      WORKSPACE_OWNER,
      at(10_000),
    );
    expect(unwrap(retried).status).toBe('running');

    // Retried step takes another 1500ms, then the approval step waits.
    const detail = await getRun(result.runId, { now: at(12_000) });
    expect(detail!.run.status).toBe('waiting_approval');
    expect(detail!.run.steps[2].status).toBe('completed');
    expect(detail!.run.steps[2].attempts).toBe(2);
    expect(detail!.run.steps[2].error).toBeNull();
    expect(detail!.events.map((event) => event.type)).toContain('step_retried');
  });
});

describe('pause, resume, cancel', () => {
  test('pause freezes progress and resume continues where it left off', async () => {
    const runId = await startQuoteRun();
    // Step 1 (1300ms) starts at 400ms and would finish at 1700ms.
    await getRun(runId, { now: at(500) });

    const paused = await applyRunAction({ runId, action: 'pause' }, WORKSPACE_OWNER, at(1000));
    expect(unwrap(paused).status).toBe('paused');

    // A long time passes; a paused run must not advance.
    const whilePaused = await getRun(runId, { now: at(100_000) });
    expect(whilePaused!.run.status).toBe('paused');
    expect(whilePaused!.run.steps[1].status).toBe('waiting');

    // 600ms of the step had elapsed before pausing → 700ms remain.
    const resumed = await applyRunAction({ runId, action: 'resume' }, WORKSPACE_OWNER, at(100_000));
    expect(unwrap(resumed).status).toBe('running');

    const beforeDone = await getRun(runId, { now: at(100_600) });
    expect(beforeDone!.run.steps[1].status).toBe('running');

    const afterDone = await getRun(runId, { now: at(100_800) });
    expect(afterDone!.run.steps[1].status).toBe('completed');
  });

  test('cancel stops the run, cancels the active step and skips the rest', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(1000) });

    const result = await applyRunAction(
      { runId, action: 'cancel', note: 'Handled personally' },
      WORKSPACE_OWNER,
      at(1500),
    );
    expect(unwrap(result).status).toBe('cancelled');

    const detail = await getRun(runId, { now: at(2000) });
    expect(detail!.run.status).toBe('cancelled');
    expect(detail!.run.statusReason).toBe('Handled personally');
    expect(detail!.run.endedAt).not.toBeNull();
    expect(detail!.run.steps.some((step) => step.status === 'cancelled')).toBe(true);
    expect(detail!.run.steps.filter((step) => step.status === 'skipped').length).toBeGreaterThan(0);
  });
});

describe('waiting for input', () => {
  test('recording a customer reply resumes and completes the workflow', async () => {
    const result = unwrap(
      await createRun({ workflowId: 'wf_quote_followup', customerName: 'Priya Nair', now: t0 }),
    );
    // Follow-up template: 300 + 1100 + 1400 + 1200ms → waits for input at 4000ms.
    const waiting = await getRun(result.runId, { now: at(5000) });
    expect(waiting!.run.status).toBe('waiting_input');

    const provided = await applyRunAction(
      { runId: result.runId, action: 'provide_input', note: 'Customer confirmed the slot' },
      WORKSPACE_OWNER,
      at(10_000),
    );
    expect(unwrap(provided).status).toBe('running');

    // Final step takes 900ms.
    const detail = await getRun(result.runId, { now: at(12_000) });
    expect(detail!.run.status).toBe('completed');
    expect(detail!.run.steps[4].summary).toContain('Customer confirmed the slot');
    expect(detail!.events.map((event) => event.type)).toContain('input_received');
  });
});

describe('run again', () => {
  test('starts a fresh run with the next run number', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(1000) });
    await applyRunAction({ runId, action: 'cancel' }, WORKSPACE_OWNER, at(2000));

    const again = unwrap(
      await applyRunAction({ runId, action: 'run_again' }, WORKSPACE_OWNER, at(3000)),
    );
    expect(again.runId).not.toBe(runId);

    const detail = await getRun(again.runId, { now: at(3000) });
    expect(detail!.run.number).toBe(1039);
    expect(detail!.run.status).toBe('running');
    expect(detail!.run.customerName).toBe('Rahul Sharma');
  });
});

describe('log integrity', () => {
  test('events are chronological with strictly increasing sequence numbers', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });
    await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_000));
    const detail = await getRun(runId, { now: at(65_000) });

    const events = detail!.events;
    expect(events.length).toBeGreaterThan(10);
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
      expect(events[i].at.getTime()).toBeGreaterThanOrEqual(events[i - 1].at.getTime());
    }
    for (const event of events) {
      expect(event.title.length).toBeGreaterThan(0);
    }
  });
});

describe('timezone safety', () => {
  test('timestamps round-trip as instants on non-UTC machines', async () => {
    // bun:test forces TZ=UTC, which hides naive-TIMESTAMP parsing bugs.
    // Run the round-trip in a subprocess pinned to IST — with TIMESTAMPTZ
    // columns a freshly created run must still be "just started" there,
    // not hours old (which would make the simulator skip every step).
    const script = `
      process.env.DATABASE_URL = 'file:memory://';
      const { createRun, getRun, markExecutionReadyForTests } = await import('./src/features/sorted/workflows/execution/service.ts');
      const { resetExecutionTables } = await import('./src/features/sorted/workflows/execution/store.ts');
      markExecutionReadyForTests();
      await resetExecutionTables();
      const now = new Date();
      const created = await createRun({ workflowId: 'wf_quote_collector', customerName: 'TZ Probe', now });
      if (!created.ok) throw new Error('create failed');
      const detail = await getRun(created.runId, { now });
      const drift = Math.abs(detail.run.startedAt.getTime() - now.getTime());
      console.log(JSON.stringify({ status: detail.run.status, firstStep: detail.run.steps[0].status, drift }));
      const g = globalThis; if (g.pglite) await g.pglite.close();
    `;

    const proc = Bun.spawn(['bun', '-e', script], {
      cwd: `${import.meta.dir}/../../../../../..`,
      env: { ...process.env, TZ: 'Asia/Kolkata', DATABASE_URL: 'file:memory://' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [out, err, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode, err).toBe(0);
    const result = JSON.parse(out.trim().split('\n').at(-1)!) as {
      status: string;
      firstStep: string;
      drift: number;
    };
    // A skewed round-trip would make the run hours "old": fully completed
    // with a large drift. Correct behavior: still on step one, ~zero drift.
    expect(result.drift).toBeLessThan(5_000);
    expect(result.status).toBe('running');
    expect(result.firstStep).toBe('running');
  }, 30_000);
});

describe('guards', () => {
  test('actions on unknown runs fail with RUN_NOT_FOUND', async () => {
    const result = await applyRunAction(
      { runId: 'run_does_not_exist', action: 'cancel' },
      WORKSPACE_OWNER,
      t0,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('RUN_NOT_FOUND');
  });

  test('reading an unknown run returns null', async () => {
    expect(await getRun('run_does_not_exist', { now: t0 })).toBeNull();
  });

  test('completed runs refuse pause, approve and retry', async () => {
    const runId = await startQuoteRun();
    await getRun(runId, { now: at(6000) });
    await applyRunAction({ runId, action: 'approve' }, WORKSPACE_OWNER, at(60_000));
    await getRun(runId, { now: at(65_000) });

    for (const action of ['pause', 'approve', 'retry'] as const) {
      const result = await applyRunAction({ runId, action }, WORKSPACE_OWNER, at(70_000));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
    }
  });

  test('creating a run for an unknown workflow is rejected', async () => {
    const result = await createRun({ workflowId: 'wf_nope', now: t0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  test('list view advances live runs to the current state', async () => {
    const runId = await startQuoteRun();
    const runs = await listRuns({ now: at(6000) });

    const summary = runs.find((run) => run.id === runId);
    expect(summary).toBeDefined();
    expect(summary!.status).toBe('waiting_approval');
    expect(summary!.currentStepName).toBe('Owner approval');
    expect(summary!.completedStepCount).toBe(5);
  });
});
