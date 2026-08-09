import 'server-only';
import { executeQuery } from '@/lib/db';

type MetricRow = { pending_jobs: number; failed_jobs: number; stuck_jobs: number; quarantined_documents: number; provider_failures: number };

export class OperationsRepository {
  async summary(organizationId: string) {
    const [row] = await executeQuery<MetricRow>(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM jobs WHERE status IN ('pending','active')) AS pending_jobs,
        (SELECT COUNT(*)::INTEGER FROM jobs WHERE status = 'failed') AS failed_jobs,
        (SELECT COUNT(*)::INTEGER FROM jobs WHERE status = 'active' AND locked_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes') AS stuck_jobs,
        (SELECT COUNT(*)::INTEGER FROM candidate_documents WHERE organization_id = $1 AND malware_scan_status IN ('quarantined','scan_failed')) AS quarantined_documents,
        (SELECT COUNT(*)::INTEGER FROM provider_executions WHERE organization_id = $1 AND status = 'failed' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS provider_failures
    `, [organizationId]);
    return row ?? { pending_jobs: 0, failed_jobs: 0, stuck_jobs: 0, quarantined_documents: 0, provider_failures: 0 };
  }
}
