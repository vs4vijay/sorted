import { AppShell, PageHeader } from '@/components/recruiting/app-shell';
import { requireCurrentAccess } from '@/lib/auth/session';
import { providerControlSummary } from '@/lib/providers/provider-controls';
import { OperationsRepository } from '@/features/operations/repositories/operations-repository';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const access = await requireCurrentAccess('organization:manage');
  const metrics = await new OperationsRepository().summary(access.organization.id);
  const providers = providerControlSummary();
  const cards = [
    ['Queue pending', metrics.pending_jobs],
    ['Failed jobs', metrics.failed_jobs],
    ['Stuck over 15 min', metrics.stuck_jobs],
    ['Isolated documents', metrics.quarantined_documents],
    ['Provider failures · 24h', metrics.provider_failures],
  ] as const;
  return (
    <AppShell active="settings">
      <PageHeader
        eyebrow="Administration"
        title="Operations & safety"
        description="Live readiness signals and server-side provider controls for this organization."
      />
      <section className="stats-grid" aria-label="Operational health">
        {cards.map(([label, value]) => (
          <article className="surface stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="surface members-card" aria-labelledby="provider-controls">
        <h2 id="provider-controls">Provider controls</h2>
        <p>
          Disabled providers fail safely: Sarvam and email remain clearly simulated; development
          scanning uses the deterministic fixture.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Mode</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sarvam AI</td>
                <td>
                  <span className="status-pill">{providers.sarvam}</span>
                </td>
                <td>
                  <code>SARVAM_ENABLED</code>
                </td>
              </tr>
              <tr>
                <td>Email delivery</td>
                <td>
                  <span className="status-pill">{providers.email}</span>
                </td>
                <td>
                  <code>EMAIL_DELIVERY_ENABLED</code>
                </td>
              </tr>
              <tr>
                <td>Malware scanner</td>
                <td>
                  <span className="status-pill">{providers.malwareScanner}</span>
                </td>
                <td>
                  <code>MALWARE_SCANNER_ENABLED</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="surface members-card">
        <h2>Recovery checklist</h2>
        <ol>
          <li>Pause the affected provider with its server-side kill switch.</li>
          <li>Inspect failed or stuck jobs without exposing candidate content.</li>
          <li>Retry only idempotent jobs after the dependency recovers.</li>
          <li>
            Run the documented database restore and worker restart drills before re-enabling
            traffic.
          </li>
        </ol>
      </section>
    </AppShell>
  );
}
