'use server';
import { revalidatePath } from 'next/cache';
import { requireCurrentAccess } from '@/lib/auth/session';
import { UpdateRetentionPolicyInputSchema } from '@/features/organizations/schemas/access';
import { RetentionPolicyRepository } from '@/features/organizations/repositories/retention-policy-repository';
import { enqueueJob } from '@/lib/worker';
import { queue } from '@/lib/queue/postgres-queue';
import enforceRetentionPolicy from '@/workers/tasks/enforce-retention-policy';
export async function updateRetentionPolicy(formData: FormData) {
  const access = await requireCurrentAccess('organization:manage');
  const parsed = UpdateRetentionPolicyInputSchema.parse(Object.fromEntries(formData));
  await new RetentionPolicyRepository().update(
    access.organization.id,
    access.userId,
    parsed.retentionDays,
  );
  revalidatePath('/settings/privacy');
}
export async function runRetentionReview() {
  const access = await requireCurrentAccess('organization:manage');
  const dayKey = new Date().toISOString().slice(0, 10);
  try {
    const job = await enqueueJob(
      'enforce-retention-policy',
      { organizationId: access.organization.id, actorUserId: access.userId },
      { jobKey: `retention:${access.organization.id}:${dayKey}`, queue: 'privacy', maxAttempts: 3 },
    );
    if ((process.env.DATABASE_URL ?? 'file:').startsWith('file:')) {
      await enforceRetentionPolicy({
        organizationId: access.organization.id,
        actorUserId: access.userId,
      });
      await queue.completeJob(job.id);
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('already exists'))) throw error;
  }
  revalidatePath('/settings/privacy');
}
