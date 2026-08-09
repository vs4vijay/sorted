import type { ExecutionActor } from './types';

/**
 * Authorization seam for the execution layer.
 *
 * The prototype has no authentication and a single workspace (see AGENTS.md
 * "Current implementation status"), so this resolves to the workspace owner.
 * When authentication lands, replace the body with real session resolution
 * and verify the actor's account owns the workflow/run before any read or
 * action — server actions already route every request through here.
 */
export const WORKSPACE_OWNER: ExecutionActor = {
  id: 'owner_easwarendra',
  accountId: 'acct_indira_services',
  name: 'Easwarendra',
  role: 'owner',
};

export async function requireExecutionActor(): Promise<ExecutionActor> {
  return WORKSPACE_OWNER;
}
