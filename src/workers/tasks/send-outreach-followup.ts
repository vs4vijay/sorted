import type { JobPayload } from '@/lib/queue/types';
import { SequenceRepository } from '@/features/outreach/repositories/sequence-repository';

export default async function sendOutreachFollowup(payload: JobPayload) {
  const organizationId = String(payload.organizationId ?? '');
  const enrollmentId = String(payload.enrollmentId ?? '');
  if (!organizationId || !enrollmentId)
    throw new Error('Follow-up job is missing its organization or enrollment.');
  await new SequenceRepository().deliver(organizationId, enrollmentId);
}
