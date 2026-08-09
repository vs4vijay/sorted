import type { JobPayload } from '@/lib/queue/types';
import { RetentionPolicyRepository } from '@/features/organizations/repositories/retention-policy-repository';
export default async function enforceRetentionPolicy(payload: JobPayload) {
  const organizationId = String(payload.organizationId ?? ''),
    actorUserId = String(payload.actorUserId ?? '');
  if (!organizationId || !actorUserId)
    throw new Error('Retention job is missing its organization or actor.');
  await new RetentionPolicyRepository().enforce(organizationId, actorUserId);
}
