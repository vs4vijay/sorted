import { describe, expect, test } from 'bun:test';
import {
  actionsForRunStatus,
  canApplyAction,
  currentStep,
  RUN_ACTION_META,
  RUN_STATUS_META,
  STEP_STATUS_META,
} from '../state';
import { RUN_ACTIONS, RUN_STATUSES, STEP_STATUSES, type WorkflowRunStep } from '../types';

describe('actions offered per run status', () => {
  test('RUNNING offers pause and cancel', () => {
    expect(actionsForRunStatus('running')).toEqual(['pause', 'cancel']);
  });

  test('WAITING_FOR_APPROVAL offers approve and reject', () => {
    expect(actionsForRunStatus('waiting_approval')).toEqual(['approve', 'reject']);
  });

  test('FAILED offers retry and cancel', () => {
    expect(actionsForRunStatus('failed')).toEqual(['retry', 'cancel']);
  });

  test('PAUSED offers resume and cancel', () => {
    expect(actionsForRunStatus('paused')).toEqual(['resume', 'cancel']);
  });

  test('WAITING_FOR_INPUT offers provide input and cancel', () => {
    expect(actionsForRunStatus('waiting_input')).toEqual(['provide_input', 'cancel']);
  });

  test('COMPLETED only offers run again — no invalid actions', () => {
    expect(actionsForRunStatus('completed')).toEqual(['run_again']);
    for (const action of ['approve', 'reject', 'retry', 'pause', 'resume', 'cancel'] as const) {
      expect(canApplyAction('completed', action)).toBe(false);
    }
  });

  test('CANCELLED only offers run again', () => {
    expect(actionsForRunStatus('cancelled')).toEqual(['run_again']);
  });

  test('QUEUED can only be cancelled', () => {
    expect(actionsForRunStatus('queued')).toEqual(['cancel']);
  });

  test('approve is never available outside waiting_approval', () => {
    for (const status of RUN_STATUSES) {
      expect(canApplyAction(status, 'approve')).toBe(status === 'waiting_approval');
    }
  });

  test('retry is never available outside failed', () => {
    for (const status of RUN_STATUSES) {
      expect(canApplyAction(status, 'retry')).toBe(status === 'failed');
    }
  });
});

describe('state metadata completeness', () => {
  test('every run status has presentation metadata and a non-color indicator', () => {
    for (const status of RUN_STATUSES) {
      const meta = RUN_STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.explanation.length).toBeGreaterThan(0);
      expect(meta.symbol.length).toBeGreaterThan(0);
    }
  });

  test('every step status has presentation metadata', () => {
    for (const status of STEP_STATUSES) {
      expect(STEP_STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(STEP_STATUS_META[status].symbol.length).toBeGreaterThan(0);
    }
  });

  test('every action has button metadata', () => {
    for (const action of RUN_ACTIONS) {
      expect(RUN_ACTION_META[action].label.length).toBeGreaterThan(0);
      expect(RUN_ACTION_META[action].pendingLabel.length).toBeGreaterThan(0);
    }
  });

  test('destructive actions require confirmation', () => {
    expect(RUN_ACTION_META.cancel.confirm).toBeDefined();
    expect(RUN_ACTION_META.reject.confirm).toBeDefined();
  });
});

describe('currentStep', () => {
  const step = (index: number, status: WorkflowRunStep['status']): WorkflowRunStep => ({
    id: `step_${index}`,
    runId: 'run_1',
    index,
    name: `Step ${index}`,
    kind: 'action',
    actor: null,
    status,
    attempts: 1,
    startedAt: null,
    completedAt: null,
    summary: null,
    output: null,
    error: null,
  });

  test('prefers a failed step over a waiting one', () => {
    const steps = [step(0, 'completed'), step(1, 'failed'), step(2, 'waiting')];
    expect(currentStep({ steps })?.id).toBe('step_1');
  });

  test('falls back to the running/waiting step', () => {
    const steps = [step(0, 'completed'), step(1, 'running'), step(2, 'pending')];
    expect(currentStep({ steps })?.id).toBe('step_1');
  });

  test('returns null when nothing is active', () => {
    const steps = [step(0, 'completed'), step(1, 'completed')];
    expect(currentStep({ steps })).toBeNull();
  });
});
