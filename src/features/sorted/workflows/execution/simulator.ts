import { templateForWorkflow, type StepTemplate } from './templates';
import {
  appendRunEvent,
  updateRunRecord,
  updateStepRecord,
} from './store';
import type { WorkflowRun, WorkflowRunStep } from './types';

/**
 * Simulated workflow executor.
 *
 * Runs are advanced lazily and deterministically: every read passes the run
 * through `advanceRun(run, now)`, which persists any step transitions whose
 * planned time has elapsed. State lives entirely in the database — the UI
 * never fakes progress with frontend timers — so a real executor (worker
 * task driven, see src/workers/tasks) can replace this module without any
 * UI changes.
 *
 * Every transition is recorded as an auditable, business-readable event.
 */

function stepMetadata(
  run: WorkflowRun,
  step: WorkflowRunStep,
  template: StepTemplate,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    simulated: true,
    run_id: run.id,
    step_id: step.id,
    step_index: step.index,
    attempt: step.attempts,
    planned_duration_ms: template.plannedDurationMs,
    ...(template.actor ? { actor: template.actor } : {}),
    ...extra,
  };
}

/**
 * Advance a live run to `now`. Returns true when anything changed.
 * Callers should hold the per-run lock (see service.ts).
 */
export async function advanceRun(run: WorkflowRun, now: Date): Promise<boolean> {
  const template = templateForWorkflow(run.workflowId);
  if (!template) return false;

  let changed = false;
  let status = run.status;
  const steps = run.steps.map((step) => ({ ...step }));

  if (status === 'queued') {
    status = 'running';
    await updateRunRecord(run.id, { status: 'running' }, run.startedAt);
    await appendRunEvent({
      runId: run.id,
      type: 'run_started',
      level: 'info',
      title: 'Run started',
      description: run.trigger,
      metadata: { simulated: true, run_id: run.id, workflow_id: run.workflowId },
      at: run.startedAt,
    });
    changed = true;
  }

  while (status === 'running') {
    const runningStep = steps.find((step) => step.status === 'running');

    if (runningStep) {
      const stepTemplate = template.steps[runningStep.index];
      if (!stepTemplate || !runningStep.startedAt) break;

      const dueAt = new Date(runningStep.startedAt.getTime() + stepTemplate.plannedDurationMs);
      if (now.getTime() < dueAt.getTime()) break; // still working on this step

      const shouldFail =
        stepTemplate.behavior === 'fail_first_attempt' &&
        runningStep.attempts <= 1 &&
        stepTemplate.failure;

      if (shouldFail) {
        const failure = stepTemplate.failure!;
        await updateStepRecord(runningStep.id, {
          status: 'failed',
          completedAt: dueAt,
          error: failure,
        });
        await appendRunEvent({
          runId: run.id,
          stepId: runningStep.id,
          type: 'step_failed',
          level: 'error',
          title: runningStep.name,
          description: failure.message,
          metadata: stepMetadata(run, runningStep, stepTemplate, {
            error: failure,
          }),
          at: dueAt,
        });

        status = 'failed';
        await updateRunRecord(
          run.id,
          { status: 'failed', statusReason: failure.message },
          dueAt,
        );
        await appendRunEvent({
          runId: run.id,
          stepId: runningStep.id,
          type: 'run_failed',
          level: 'error',
          title: 'Run failed',
          description: `${runningStep.name} — ${failure.message}`,
          metadata: { simulated: true, run_id: run.id, error_code: failure.code },
          at: dueAt,
        });
        changed = true;
        break;
      }

      // Declared side effects are recorded with an honest outcome: while the
      // executor is simulated nothing real was delivered, so the status is
      // 'simulated' — never 'executed'.
      const effectOutcomes = stepTemplate.sideEffects?.map((effect) => ({
        ...effect,
        status: 'simulated' as const,
      }));
      const output =
        stepTemplate.output || effectOutcomes
          ? { ...stepTemplate.output, ...(effectOutcomes ? { side_effects: effectOutcomes } : {}) }
          : null;

      await updateStepRecord(runningStep.id, {
        status: 'completed',
        completedAt: dueAt,
        summary: stepTemplate.summary,
        output,
        error: null,
      });
      await appendRunEvent({
        runId: run.id,
        stepId: runningStep.id,
        type: 'step_completed',
        level: 'success',
        title: runningStep.name,
        description: stepTemplate.summary,
        metadata: stepMetadata(run, runningStep, stepTemplate, {
          duration_ms: stepTemplate.plannedDurationMs,
          ...(output ? { output } : {}),
        }),
        at: dueAt,
      });

      runningStep.status = 'completed';
      runningStep.completedAt = dueAt;
      changed = true;
      continue;
    }

    // Nothing running: start the next pending step, or finish the run.
    const lastCompletionTime = steps.reduce<Date | null>(
      (latest, step) =>
        step.completedAt && (!latest || step.completedAt > latest) ? step.completedAt : latest,
      null,
    );
    const cursor = lastCompletionTime ?? run.startedAt;
    const nextStep = steps.find((step) => step.status === 'pending');

    if (!nextStep) {
      status = 'completed';
      await updateRunRecord(run.id, { status: 'completed', endedAt: cursor }, cursor);
      await appendRunEvent({
        runId: run.id,
        type: 'run_completed',
        level: 'success',
        title: 'Run completed',
        description: 'All steps finished.',
        metadata: { simulated: true, run_id: run.id },
        at: cursor,
      });
      changed = true;
      break;
    }

    const stepTemplate = template.steps[nextStep.index];
    if (!stepTemplate) break;

    if (stepTemplate.behavior === 'wait_approval' || stepTemplate.behavior === 'wait_input') {
      const waiting = stepTemplate.behavior === 'wait_approval';
      await updateStepRecord(nextStep.id, {
        status: 'waiting',
        startedAt: cursor,
        attempts: nextStep.attempts + 1,
        summary: stepTemplate.waitingDescription ?? null,
      });
      await appendRunEvent({
        runId: run.id,
        stepId: nextStep.id,
        type: waiting ? 'approval_requested' : 'input_requested',
        level: 'warning',
        title: waiting ? 'Waiting for your approval' : 'Waiting for input',
        description: stepTemplate.waitingDescription ?? null,
        metadata: stepMetadata(run, nextStep, stepTemplate),
        at: cursor,
      });

      status = waiting ? 'waiting_approval' : 'waiting_input';
      await updateRunRecord(run.id, { status }, cursor);
      changed = true;
      break;
    }

    await updateStepRecord(nextStep.id, {
      status: 'running',
      startedAt: cursor,
      attempts: nextStep.attempts + 1,
    });
    await appendRunEvent({
      runId: run.id,
      stepId: nextStep.id,
      type: 'step_started',
      level: 'info',
      title: nextStep.name,
      description: stepTemplate.actor ? `Started · ${stepTemplate.actor}` : 'Started',
      metadata: stepMetadata(run, { ...nextStep, attempts: nextStep.attempts + 1 }, stepTemplate),
      at: cursor,
    });

    nextStep.status = 'running';
    nextStep.startedAt = cursor;
    nextStep.attempts += 1;
    changed = true;
  }

  return changed;
}
