import { z } from 'zod';

/**
 * Workflow execution domain model.
 *
 * `WorkflowRun` is one execution of a workflow definition. `WorkflowRunStep`
 * is the execution of a single node. `WorkflowRunEvent` is the append-only,
 * auditable log of everything that happened (see AGENTS.md "Core domain").
 *
 * These types are the contract between the UI and any executor. The current
 * executor is simulated (see simulator.ts); a real one must satisfy the same
 * contract.
 */

export const RUN_STATUSES = [
  'queued',
  'running',
  'waiting_input',
  'waiting_approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const runStatusSchema = z.enum(RUN_STATUSES);

export const STEP_STATUSES = [
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const stepStatusSchema = z.enum(STEP_STATUSES);

/** What kind of node a step executes. Drives iconography, nothing else. */
export const STEP_KINDS = ['trigger', 'ai', 'condition', 'action', 'approval', 'wait', 'send'] as const;

export type StepKind = (typeof STEP_KINDS)[number];

/** Owner-facing operations on a run. */
export const RUN_ACTIONS = [
  'approve',
  'reject',
  'retry',
  'pause',
  'resume',
  'cancel',
  'provide_input',
  'run_again',
] as const;

export type RunAction = (typeof RUN_ACTIONS)[number];

export const runActionSchema = z.enum(RUN_ACTIONS);

export const RUN_EVENT_TYPES = [
  'run_queued',
  'run_started',
  'run_paused',
  'run_resumed',
  'run_completed',
  'run_failed',
  'run_cancelled',
  'step_started',
  'step_completed',
  'step_failed',
  'step_retried',
  'approval_requested',
  'approval_granted',
  'approval_rejected',
  'input_requested',
  'input_received',
] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export type RunEventLevel = 'info' | 'success' | 'warning' | 'error';

export interface StepError {
  /** Stable machine code, e.g. AI_RESPONSE_GENERATION_FAILED. */
  code: string;
  /** Business-readable, e.g. "Unable to generate a response draft." */
  message: string;
  /** Technical detail shown behind a disclosure. */
  details?: string;
  retryable: boolean;
}

export interface WorkflowRunStep {
  id: string;
  runId: string;
  /** 0-based position inside the run. */
  index: number;
  name: string;
  kind: StepKind;
  /** Who/what performs the step, e.g. "Sarvam-105B", "Owner", "Bulbul / WhatsApp". */
  actor: string | null;
  status: StepStatus;
  /** How many times this step has been started (retries increment it). */
  attempts: number;
  startedAt: Date | null;
  completedAt: Date | null;
  /** Business-readable result, e.g. "Intent detected: quote request". */
  summary: string | null;
  /** Structured output for the technical disclosure. */
  output: Record<string, unknown> | null;
  error: StepError | null;
}

export interface WorkflowRun {
  id: string;
  /** Human-friendly sequence, rendered as "Run #1042". */
  number: number;
  workflowId: string;
  workflowName: string;
  /** Business-readable trigger, e.g. "New quote request on WhatsApp". */
  trigger: string;
  customerName: string | null;
  conversationId: string | null;
  status: RunStatus;
  /** Why the run is in its current terminal/attention state, if noteworthy. */
  statusReason: string | null;
  /** True while execution is simulated rather than performed by a real executor. */
  simulated: boolean;
  startedAt: Date;
  endedAt: Date | null;
  updatedAt: Date;
  steps: WorkflowRunStep[];
}

/** Run without steps, as listed on the history screen. */
export type WorkflowRunSummary = Omit<WorkflowRun, 'steps'> & {
  stepCount: number;
  completedStepCount: number;
  /** Name of the step currently running/waiting/failed, if any. */
  currentStepName: string | null;
};

export interface WorkflowRunEvent {
  id: string;
  runId: string;
  stepId: string | null;
  /** Monotonic order inside the run; timestamps alone may collide. */
  seq: number;
  type: RunEventType;
  level: RunEventLevel;
  /** Business-readable headline, e.g. "Intent detected". */
  title: string;
  description: string | null;
  /** Technical payload for the expandable disclosure. */
  metadata: Record<string, unknown> | null;
  at: Date;
}

export interface ExecutionActor {
  id: string;
  accountId: string;
  name: string;
  role: 'owner';
}

export const runActionInputSchema = z.object({
  runId: z.string().min(1),
  action: runActionSchema,
  /** Optional owner note, e.g. a rejection reason. */
  note: z.string().trim().max(500).optional(),
});

export type RunActionInput = z.infer<typeof runActionInputSchema>;

export interface ExecutionError {
  code:
    | 'RUN_NOT_FOUND'
    | 'INVALID_TRANSITION'
    | 'INVALID_INPUT'
    | 'NOT_AUTHORIZED'
    | 'INTERNAL';
  message: string;
}

export type ActionResult =
  | { ok: true; runId: string; status: RunStatus; message: string }
  | { ok: false; error: ExecutionError };
