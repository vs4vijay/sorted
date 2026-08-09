'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireExecutionActor } from './auth';
import { applyRunAction, createRun } from './service';
import { runActionInputSchema, type ActionResult } from './types';

/**
 * Server actions for the execution layer. The UI never mutates run state
 * directly — every interaction goes through here:
 *
 *   UI → server action → execution service → simulated executor → database
 *
 * Inputs from the client are untrusted and validated with Zod. Authorization
 * is resolved server-side via requireExecutionActor().
 */

export async function performRunAction(input: unknown): Promise<ActionResult> {
  const parsed = runActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That request was not valid.' },
    };
  }

  try {
    const actor = await requireExecutionActor();
    const result = await applyRunAction(parsed.data, actor);

    if (result.ok) {
      revalidatePath('/workflows/runs');
      revalidatePath(`/workflows/runs/${parsed.data.runId}`);
      if (result.runId !== parsed.data.runId) {
        revalidatePath(`/workflows/runs/${result.runId}`);
      }
    }

    return result;
  } catch (error) {
    console.error('workflow run action failed', error);
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
    };
  }
}

const startRunInputSchema = z.object({
  workflowId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120).optional(),
  conversationId: z.string().trim().min(1).max(120).optional(),
});

export async function startWorkflowRun(input: unknown): Promise<ActionResult> {
  const parsed = startRunInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That request was not valid.' },
    };
  }

  try {
    await requireExecutionActor();
    const result = await createRun({
      workflowId: parsed.data.workflowId,
      customerName: parsed.data.customerName ?? null,
      conversationId: parsed.data.conversationId ?? null,
    });

    if (result.ok) {
      revalidatePath('/workflows/runs');
    }

    return result;
  } catch (error) {
    console.error('workflow run start failed', error);
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
    };
  }
}
