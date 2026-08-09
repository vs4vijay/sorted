import type {
  RunAction,
  RunEventLevel,
  RunStatus,
  StepKind,
  StepStatus,
  WorkflowRun,
  WorkflowRunStep,
} from './types';

/**
 * Single source of truth mapping execution state to presentation and to the
 * actions a user may take. UI components and server-side guards both read
 * from these tables — do not scatter `if (status === 'running')` checks.
 */

export type StatusTone = 'neutral' | 'active' | 'attention' | 'success' | 'danger' | 'muted';

export interface RunStatusMeta {
  label: string;
  /** One-line business-readable explanation shown in the status banner. */
  explanation: string;
  tone: StatusTone;
  /** Non-color indicator so state never relies on color alone. */
  symbol: string;
  /** True while the run can still make progress on its own. */
  isLive: boolean;
  isTerminal: boolean;
}

export const RUN_STATUS_META: Record<RunStatus, RunStatusMeta> = {
  queued: {
    label: 'Queued',
    explanation: 'This run is waiting to start.',
    tone: 'neutral',
    symbol: '◌',
    isLive: true,
    isTerminal: false,
  },
  running: {
    label: 'Running',
    explanation: 'Sorted is working through the steps of this workflow.',
    tone: 'active',
    symbol: '●',
    isLive: true,
    isTerminal: false,
  },
  waiting_input: {
    label: 'Waiting for input',
    explanation: 'The workflow is paused until the requested information arrives.',
    tone: 'attention',
    symbol: '◐',
    isLive: false,
    isTerminal: false,
  },
  waiting_approval: {
    label: 'Waiting for approval',
    explanation: 'Sorted prepared everything and needs your approval before continuing.',
    tone: 'attention',
    symbol: '◐',
    isLive: false,
    isTerminal: false,
  },
  paused: {
    label: 'Paused',
    explanation: 'You paused this run. Resume it whenever you are ready.',
    tone: 'neutral',
    symbol: '❚❚',
    isLive: false,
    isTerminal: false,
  },
  completed: {
    label: 'Completed',
    explanation: 'Every step finished successfully.',
    tone: 'success',
    symbol: '✓',
    isLive: false,
    isTerminal: true,
  },
  failed: {
    label: 'Failed',
    explanation: 'A step could not complete. Review the error, then retry or cancel the run.',
    tone: 'danger',
    symbol: '✕',
    isLive: false,
    isTerminal: false,
  },
  cancelled: {
    label: 'Cancelled',
    explanation: 'This run was stopped before it finished.',
    tone: 'muted',
    symbol: '⊘',
    isLive: false,
    isTerminal: true,
  },
};

export interface StepStatusMeta {
  label: string;
  symbol: string;
  tone: StatusTone;
}

export const STEP_STATUS_META: Record<StepStatus, StepStatusMeta> = {
  pending: { label: 'Pending', symbol: '○', tone: 'muted' },
  running: { label: 'In progress', symbol: '●', tone: 'active' },
  waiting: { label: 'Waiting', symbol: '◐', tone: 'attention' },
  completed: { label: 'Done', symbol: '✓', tone: 'success' },
  failed: { label: 'Failed', symbol: '✕', tone: 'danger' },
  skipped: { label: 'Skipped', symbol: '–', tone: 'muted' },
  cancelled: { label: 'Cancelled', symbol: '⊘', tone: 'muted' },
};

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  trigger: 'Trigger',
  ai: 'Sarvam-105B',
  condition: 'Decision',
  action: 'Action',
  approval: 'Human in the loop',
  wait: 'Wait',
  send: 'Outbound',
};

/**
 * The actions offered for each run state, in display order.
 * Also used server-side to reject illegal transitions.
 */
const ACTIONS_BY_STATUS: Record<RunStatus, RunAction[]> = {
  queued: ['cancel'],
  running: ['pause', 'cancel'],
  waiting_input: ['provide_input', 'cancel'],
  waiting_approval: ['approve', 'reject'],
  paused: ['resume', 'cancel'],
  completed: ['run_again'],
  failed: ['retry', 'cancel'],
  cancelled: ['run_again'],
};

export function actionsForRunStatus(status: RunStatus): RunAction[] {
  return ACTIONS_BY_STATUS[status];
}

export function canApplyAction(status: RunStatus, action: RunAction): boolean {
  return ACTIONS_BY_STATUS[status].includes(action);
}

export interface RunActionMeta {
  label: string;
  pendingLabel: string;
  /** Visual weight of the button. */
  variant: 'primary' | 'default' | 'danger';
  /** Set when the action is destructive/irreversible and needs confirmation. */
  confirm?: {
    title: string;
    body: string;
    confirmLabel: string;
    /** Offer an optional note field (e.g. rejection reason). */
    withNote?: boolean;
  };
}

export const RUN_ACTION_META: Record<RunAction, RunActionMeta> = {
  approve: {
    label: 'Approve & continue',
    pendingLabel: 'Approving…',
    variant: 'primary',
  },
  reject: {
    label: 'Reject',
    pendingLabel: 'Rejecting…',
    variant: 'danger',
    confirm: {
      title: 'Reject this response?',
      body: 'The drafted response will not be sent and the run will stop. This cannot be undone.',
      confirmLabel: 'Reject response',
      withNote: true,
    },
  },
  retry: {
    label: 'Retry failed step',
    pendingLabel: 'Retrying…',
    variant: 'primary',
  },
  pause: {
    label: 'Pause',
    pendingLabel: 'Pausing…',
    variant: 'default',
  },
  resume: {
    label: 'Resume',
    pendingLabel: 'Resuming…',
    variant: 'primary',
  },
  cancel: {
    label: 'Cancel run',
    pendingLabel: 'Cancelling…',
    variant: 'danger',
    confirm: {
      title: 'Cancel this run?',
      body: 'Remaining steps will not execute and the run will be marked as cancelled. This cannot be undone.',
      confirmLabel: 'Cancel run',
    },
  },
  provide_input: {
    label: 'Record customer reply',
    pendingLabel: 'Recording…',
    variant: 'primary',
    confirm: {
      title: 'Record the customer’s reply',
      body: 'Paste or summarize what the customer said. The workflow continues with this information.',
      confirmLabel: 'Record reply',
      withNote: true,
    },
  },
  run_again: {
    label: 'Run again',
    pendingLabel: 'Starting…',
    variant: 'default',
  },
};

/** The step the user should look at first: running, waiting or failed. */
export function currentStep(run: Pick<WorkflowRun, 'steps'>): WorkflowRunStep | null {
  return (
    run.steps.find((step) => step.status === 'failed') ??
    run.steps.find((step) => step.status === 'running' || step.status === 'waiting') ??
    null
  );
}

export function stepDurationMs(step: WorkflowRunStep): number | null {
  if (!step.startedAt || !step.completedAt) return null;
  return Math.max(0, step.completedAt.getTime() - step.startedAt.getTime());
}

export const EVENT_LEVEL_SYMBOL: Record<RunEventLevel, string> = {
  info: '·',
  success: '✓',
  warning: '◐',
  error: '✕',
};
