import { executeQuery } from '@/lib/db';
type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;
export class RetentionPolicyRepository {
  constructor(private query: Query = executeQuery) {}
  async update(organizationId: string, actorUserId: string, retentionDays: number) {
    const rows = await this.query(
      `WITH changed AS (UPDATE organizations SET retention_days=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $3,$2,$4,'organization.retention_policy_updated','organization',$2,json_build_object('retention_days',$1::INTEGER) FROM changed RETURNING subject_id`,
      [retentionDays, organizationId, crypto.randomUUID(), actorUserId],
    );
    if (!rows[0]) throw new Error('Organization not found.');
  }
  async enforce(organizationId: string, actorUserId: string) {
    const policy = (await this.query(
      `SELECT retention_days FROM organizations WHERE id=$1 AND status='active'`,
      [organizationId],
    )) as { retention_days: number }[];
    if (!policy[0]) throw new Error('Active organization not found.');
    const rows = await this.query(
      `WITH eligible AS (SELECT c.id FROM candidates c WHERE c.organization_id=$1 AND c.profile_status<>'anonymized' AND c.created_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 day') AND NOT EXISTS (SELECT 1 FROM candidate_privacy_requests r WHERE r.organization_id=$1 AND r.candidate_id=c.id AND r.request_type='deletion' AND r.status IN ('requested','approved'))), created AS (INSERT INTO candidate_privacy_requests(id,organization_id,candidate_id,request_type,status,details,requested_by_id) SELECT gen_random_uuid()::TEXT,$1,id,'deletion','requested','Retention policy review: candidate record is older than ' || $2::TEXT || ' days.',$3 FROM eligible RETURNING id,candidate_id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT gen_random_uuid()::TEXT,$1,$3,'candidate_privacy.retention_review_requested','candidate_privacy_request',id,json_build_object('candidate_id',candidate_id,'retention_days',$2::INTEGER) FROM created RETURNING subject_id`,
      [organizationId, policy[0].retention_days, actorUserId],
    );
    return rows.length;
  }
}
