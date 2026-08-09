import 'server-only';
import { executeQuery } from '@/lib/db';

export const RATE_LIMITS = {
  candidate_upload: { limit: 20, windowSeconds: 3600 },
  candidate_match: { limit: 60, windowSeconds: 3600 },
  member_invitation: { limit: 20, windowSeconds: 3600 },
  candidate_export: { limit: 20, windowSeconds: 3600 },
  email_send: { limit: 50, windowSeconds: 3600 },
} as const;
export type RateLimitedAction = keyof typeof RATE_LIMITS;

export class RateLimitError extends Error {
  constructor(public readonly action: RateLimitedAction) {
    super('This action has reached its safety limit. Try again later or ask an administrator.');
    this.name = 'RateLimitError';
  }
}

export async function enforceRateLimit(organizationId: string, actorId: string, action: RateLimitedAction) {
  const policy = RATE_LIMITS[action];
  const cutoff = new Date(Date.now() - policy.windowSeconds * 1000);
  const rows = await executeQuery<{ accepted: boolean }>(`
    WITH recent AS (
      SELECT COUNT(*)::INTEGER AS count FROM rate_limit_events
      WHERE organization_id = $1 AND actor_id = $2 AND action = $3 AND created_at >= $4
    ), inserted AS (
      INSERT INTO rate_limit_events (id, organization_id, actor_id, action)
      SELECT $5, $1, $2, $3 FROM recent WHERE count < $6 RETURNING id
    )
    SELECT EXISTS(SELECT 1 FROM inserted) AS accepted
  `, [organizationId, actorId, action, cutoff, crypto.randomUUID(), policy.limit]);
  if (!rows[0]?.accepted) throw new RateLimitError(action);
}
