'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireCurrentAccess } from '@/lib/auth/session';
import { CreatePositionSchema } from '@/features/positions/schemas/position';
import { structureJobDescription } from '@/features/positions/sarvam/job-description-provider';
import { PositionRepository } from '@/features/positions/repositories/position-repository';

export type PositionActionState = { error?: string };
export async function createPosition(_: PositionActionState, formData: FormData): Promise<PositionActionState> {
  const access = await requireCurrentAccess('positions:manage');
  const parsed = CreatePositionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the position details.' };
  const structured = await structureJobDescription(parsed.data.jobDescription, parsed.data.title);
  const id = crypto.randomUUID();
  await new PositionRepository().create({ id, organizationId: access.organization.id, actorId: access.userId, ...parsed.data, rawText: parsed.data.jobDescription, structured: structured.data, execution: structured.execution, jobDescriptionId: crypto.randomUUID(), rubricId: crypto.randomUUID(), executionId: crypto.randomUUID(), auditId: crypto.randomUUID() });
  redirect(`/positions/${id}`);
}
export async function approveRubric(positionId:string, rubricId:string) { const access=await requireCurrentAccess('rubrics:approve'); const ok=await new PositionRepository().approve({organizationId:access.organization.id,positionId,rubricId,actorId:access.userId,auditId:crypto.randomUUID()}); if(!ok) throw new Error('Rubric must be a draft and scored weights must total 100.'); revalidatePath(`/positions/${positionId}`); }
