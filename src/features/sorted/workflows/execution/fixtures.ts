import type { RunAction } from './types';

/**
 * Seeded demo history, clearly separated from the UI.
 *
 * Each scenario is replayed through the real service functions (create →
 * advance → owner actions) with historical timestamps, so seeded runs have
 * exactly the same shape, transitions and audit trail as live ones. The UI
 * cannot tell the difference — which is the point.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface SeedScenario {
  runId: string;
  workflowId: string;
  customerName: string;
  conversationId: string;
  /** How long before "now" the run started. */
  startedAgoMs: number;
  /** Replayed in order; offsets are relative to the run start. */
  script: Array<
    | { do: 'advance'; atOffsetMs: number }
    | { do: 'action'; action: RunAction; atOffsetMs: number; note?: string }
  >;
}

export const SEED_SCENARIOS: SeedScenario[] = [
  // #1038 — cancelled mid-run two days ago.
  {
    runId: 'run_seed_sarah',
    workflowId: 'wf_quote_collector',
    customerName: "Sarah D'Souza",
    conversationId: 'conv_sarah',
    startedAgoMs: 2 * 24 * HOUR,
    script: [
      { do: 'advance', atOffsetMs: 2_200 },
      { do: 'action', action: 'cancel', atOffsetMs: 2_500, note: 'Handled over a phone call instead' },
    ],
  },
  // #1039 — completed yesterday: approved and sent.
  {
    runId: 'run_seed_meera',
    workflowId: 'wf_quote_collector',
    customerName: 'Meera Iyer',
    conversationId: 'conv_meera',
    startedAgoMs: 26 * HOUR,
    script: [
      { do: 'advance', atOffsetMs: 6_000 },
      { do: 'action', action: 'approve', atOffsetMs: 3 * MINUTE },
      { do: 'advance', atOffsetMs: 3 * MINUTE + 5_000 },
    ],
  },
  // #1040 — reminder sent, waiting for the customer to reply.
  {
    runId: 'run_seed_priya',
    workflowId: 'wf_quote_followup',
    customerName: 'Priya Nair',
    conversationId: 'conv_priya',
    startedAgoMs: 3 * HOUR,
    script: [{ do: 'advance', atOffsetMs: 6_000 }],
  },
  // #1041 — failed an hour ago while drafting the recovery response.
  {
    runId: 'run_seed_ahmed',
    workflowId: 'wf_complaint_recovery',
    customerName: 'Ahmed Khan',
    conversationId: 'conv_ahmed',
    startedAgoMs: 65 * MINUTE,
    script: [{ do: 'advance', atOffsetMs: 4_000 }],
  },
  // #1042 — the hero demo run: everything prepared, waiting for approval.
  {
    runId: 'run_seed_rahul',
    workflowId: 'wf_quote_collector',
    customerName: 'Rahul Sharma',
    conversationId: 'conv_rahul',
    startedAgoMs: 14 * MINUTE,
    script: [{ do: 'advance', atOffsetMs: 6_000 }],
  },
];

/** Stable id the Dashboard notification links to. */
export const HERO_RUN_ID = 'run_seed_rahul';
