import type { StepError, StepKind } from './types';

/**
 * Simulation templates for the workflows shown in the prototype.
 *
 * The simulated executor (simulator.ts) uses these scripts to advance
 * persisted runs deterministically. When the real executor lands, workflow
 * definitions come from the workflow builder instead and this file goes away;
 * nothing in the UI depends on it.
 */

export type StepBehavior = 'auto' | 'wait_approval' | 'wait_input' | 'fail_first_attempt';

/**
 * A side effect a step declares it will perform on the outside world
 * (message delivery, voice generation, …). Effects are declared up front and
 * their outcome is recorded on completion — while execution is simulated the
 * recorded status is always 'simulated', never pretending delivery happened.
 * The real executor must persist run/step state BEFORE triggering these and
 * record provider request ids with an 'executed' status (see AGENTS.md).
 */
export interface DeclaredSideEffect {
  kind: 'whatsapp_message' | 'voice_note';
  description: string;
}

export interface StepTemplate {
  name: string;
  kind: StepKind;
  actor: string | null;
  /** Simulated execution time once the step starts. */
  plannedDurationMs: number;
  behavior: StepBehavior;
  /** Business-readable result recorded when the step completes. */
  summary: string;
  /** Structured output recorded when the step completes. */
  output?: Record<string, unknown>;
  /** Shown while the step is waiting (approval / input steps). */
  waitingDescription?: string;
  /** Error recorded when behavior is `fail_first_attempt` and attempts === 1. */
  failure?: StepError;
  /** Outside-world effects this step performs; outcomes recorded on completion. */
  sideEffects?: DeclaredSideEffect[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  trigger: string;
  steps: StepTemplate[];
}

const SIMULATED = { simulated: true } as const;

export const QUOTE_COLLECTOR_TEMPLATE: WorkflowTemplate = {
  id: 'wf_quote_collector',
  name: 'Quote information collector',
  trigger: 'New quote request on WhatsApp',
  steps: [
    {
      name: 'Trigger received',
      kind: 'trigger',
      actor: 'WhatsApp',
      plannedDurationMs: 400,
      behavior: 'auto',
      summary: 'New WhatsApp message from the customer',
      output: { ...SIMULATED, channel: 'whatsapp', language: 'hi-IN' },
    },
    {
      name: 'Understand customer message',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1300,
      behavior: 'auto',
      summary: 'Intent detected: quote request + booking request',
      output: {
        ...SIMULATED,
        model: 'sarvam-105b',
        intents: [
          { intent: 'quote_request', confidence: 0.96 },
          { intent: 'booking_request', confidence: 0.91 },
        ],
      },
    },
    {
      name: 'Extract quote requirements',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1200,
      behavior: 'auto',
      summary: 'Found: AC servicing · tomorrow around 6 PM · Indiranagar',
      output: {
        ...SIMULATED,
        model: 'sarvam-105b',
        facts: { service: 'AC servicing', time: 'tomorrow 18:00', area: 'Indiranagar' },
      },
    },
    {
      name: 'Check for missing information',
      kind: 'condition',
      actor: 'Sorted',
      plannedDurationMs: 600,
      behavior: 'auto',
      summary: 'Missing: AC model and exact address',
      output: { ...SIMULATED, missing: ['ac_model', 'exact_address'], branch: 'ask_customer' },
    },
    {
      name: 'Draft question for customer',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1500,
      behavior: 'auto',
      summary: 'Hindi draft prepared for your review',
      output: {
        ...SIMULATED,
        model: 'sarvam-105b',
        draft_language: 'hi-IN',
        draft:
          'Namaste! Kal 6 baje ka slot available hai. Sahi quote ke liye AC ka model aur exact address share kar dijiye.',
      },
    },
    {
      name: 'Owner approval',
      kind: 'approval',
      actor: 'Owner',
      plannedDurationMs: 0,
      behavior: 'wait_approval',
      summary: 'Response approved',
      waitingDescription: 'Review the drafted reply before it is sent to the customer.',
    },
    {
      name: 'Send response',
      kind: 'send',
      actor: 'Bulbul / WhatsApp',
      plannedDurationMs: 1400,
      behavior: 'auto',
      summary: 'Reply sent in Hindi (text + voice note)',
      output: { ...SIMULATED, channel: 'whatsapp', voice: 'bulbul', language: 'hi-IN' },
      sideEffects: [
        { kind: 'whatsapp_message', description: 'Send the approved reply on WhatsApp' },
        { kind: 'voice_note', description: 'Generate a Hindi voice note with Bulbul' },
      ],
    },
  ],
};

export const QUOTE_FOLLOWUP_TEMPLATE: WorkflowTemplate = {
  id: 'wf_quote_followup',
  name: 'Unanswered quote follow-up',
  trigger: 'Quote unanswered for 24 hours',
  steps: [
    {
      name: 'Trigger received',
      kind: 'trigger',
      actor: 'Scheduler',
      plannedDurationMs: 300,
      behavior: 'auto',
      summary: 'Quote has been unanswered for 24 hours',
      output: { ...SIMULATED, rule: 'quote_unanswered_24h' },
    },
    {
      name: 'Review conversation context',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1100,
      behavior: 'auto',
      summary: 'Quote sent yesterday · no customer reply since',
      output: { ...SIMULATED, model: 'sarvam-105b', last_customer_message_hours_ago: 26 },
    },
    {
      name: 'Draft gentle reminder',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1400,
      behavior: 'auto',
      summary: "Reminder drafted in the customer's language",
      output: { ...SIMULATED, model: 'sarvam-105b', draft_language: 'en-IN' },
    },
    {
      name: 'Send reminder',
      kind: 'send',
      actor: 'WhatsApp',
      plannedDurationMs: 1200,
      behavior: 'auto',
      summary: 'Reminder sent on WhatsApp',
      output: { ...SIMULATED, channel: 'whatsapp' },
      sideEffects: [
        { kind: 'whatsapp_message', description: 'Send the reminder on WhatsApp' },
      ],
    },
    {
      name: 'Wait for customer reply',
      kind: 'wait',
      actor: 'Customer',
      plannedDurationMs: 0,
      behavior: 'wait_input',
      summary: 'Customer reply received',
      waitingDescription:
        'The workflow continues automatically when the customer replies, or you can record their reply manually.',
    },
    {
      name: 'Summarize outcome',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 900,
      behavior: 'auto',
      summary: 'Outcome summarized for you',
      output: { ...SIMULATED, model: 'sarvam-105b' },
    },
  ],
};

export const COMPLAINT_RECOVERY_TEMPLATE: WorkflowTemplate = {
  id: 'wf_complaint_recovery',
  name: 'Complaint recovery',
  trigger: 'Complaint detected in a conversation',
  steps: [
    {
      name: 'Trigger received',
      kind: 'trigger',
      actor: 'WhatsApp',
      plannedDurationMs: 300,
      behavior: 'auto',
      summary: 'Complaint detected in the conversation',
      output: { ...SIMULATED, channel: 'whatsapp' },
    },
    {
      name: 'Assess sentiment and history',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1200,
      behavior: 'auto',
      summary: 'Negative sentiment · unresolved after two visits',
      output: { ...SIMULATED, model: 'sarvam-105b', sentiment: 'negative', prior_visits: 2 },
    },
    {
      name: 'Draft apology and recovery plan',
      kind: 'ai',
      actor: 'Sarvam-105B',
      plannedDurationMs: 1500,
      behavior: 'fail_first_attempt',
      summary: 'Apology and free re-visit plan drafted',
      output: { ...SIMULATED, model: 'sarvam-105b', offer: 'free_revisit' },
      failure: {
        code: 'AI_RESPONSE_GENERATION_FAILED',
        message: 'Unable to draft the recovery response.',
        details:
          'Sarvam-105B request timed out after 20s. This is a simulated failure so the demo can show error handling; retrying succeeds.',
        retryable: true,
      },
    },
    {
      name: 'Owner approval',
      kind: 'approval',
      actor: 'Owner',
      plannedDurationMs: 0,
      behavior: 'wait_approval',
      summary: 'Response approved',
      waitingDescription: 'A personal apology is sensitive — review it before it goes out.',
    },
    {
      name: 'Send response',
      kind: 'send',
      actor: 'Bulbul / WhatsApp',
      plannedDurationMs: 1300,
      behavior: 'auto',
      summary: 'Recovery message sent',
      output: { ...SIMULATED, channel: 'whatsapp', voice: 'bulbul' },
      sideEffects: [
        { kind: 'whatsapp_message', description: 'Send the apology and recovery plan on WhatsApp' },
        { kind: 'voice_note', description: 'Generate a voice note with Bulbul' },
      ],
    },
  ],
};

const TEMPLATES: Record<string, WorkflowTemplate> = {
  [QUOTE_COLLECTOR_TEMPLATE.id]: QUOTE_COLLECTOR_TEMPLATE,
  [QUOTE_FOLLOWUP_TEMPLATE.id]: QUOTE_FOLLOWUP_TEMPLATE,
  [COMPLAINT_RECOVERY_TEMPLATE.id]: COMPLAINT_RECOVERY_TEMPLATE,
};

export function templateForWorkflow(workflowId: string): WorkflowTemplate | null {
  return TEMPLATES[workflowId] ?? null;
}
