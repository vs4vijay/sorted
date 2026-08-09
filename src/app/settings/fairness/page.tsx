import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell, PageHeader } from '@/components/recruiting/app-shell';
import { FairnessRepository } from '@/features/evaluations/repositories/fairness-repository';
import {
  AllowedMatchingInputs,
  ProhibitedMatchingInputs,
  SeparateLogisticsInputs,
} from '@/features/evaluations/schemas/fairness';
import { roleCan } from '@/features/organizations/schemas/access';
import { getCurrentAccess } from '@/lib/auth/session';
export default async function FairnessSettingsPage() {
  const access = await getCurrentAccess();
  if (!access) redirect('/sign-in');
  if (!roleCan(access.membership.role, 'organization:manage')) redirect('/');
  const evaluations = await new FairnessRepository().listEvaluations(access.organization.id);
  return (
    <AppShell active="settings">
      <PageHeader
        eyebrow="FAIRNESS & EXPLAINABILITY"
        title="How Sorted supports hiring decisions"
        description="Inspect exactly what matching may use, what it must ignore, and how each recommendation was produced."
      />
      <div className="fairness-policy-grid">
        <section className="surface policy-card allowed">
          <span className="eyebrow">ALLOWED FOR ROLE MATCHING</span>
          <h2>Job-related evidence only</h2>
          <ul>
            {AllowedMatchingInputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="surface policy-card separate">
          <span className="eyebrow">SHOWN SEPARATELY</span>
          <h2>Logistics, never hidden merit signals</h2>
          <ul>
            {SeparateLogisticsInputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="surface policy-card prohibited">
          <span className="eyebrow">PROHIBITED</span>
          <h2>Never matching inputs</h2>
          <ul>
            {ProhibitedMatchingInputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="surface reconstruction-list">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECOMMENDATION LEDGER</span>
            <h2>Reconstruct an evaluation</h2>
            <p>AI output supports review. Only recorded human actions can change a hiring stage.</p>
          </div>
          <span className="status-pill">{evaluations.length} recorded</span>
        </div>
        {evaluations.length === 0 ? (
          <div className="empty-state">
            <h3>No evaluations yet</h3>
            <p>
              Match a candidate against an approved rubric to create the first auditable record.
            </p>
            <Link className="button primary" href="/candidates">
              View candidates
            </Link>
          </div>
        ) : (
          <div className="reconstruction-rows">
            {evaluations.map((row) => (
              <Link
                className="reconstruction-row"
                href={`/settings/fairness/${String(row.id)}`}
                key={String(row.id)}
              >
                <div>
                  <strong>{String(row.candidate_name)}</strong>
                  <span>
                    {String(row.position_title)} · rubric v{String(row.rubric_version)}
                  </span>
                </div>
                <div className="reconstruction-scores">
                  <span>
                    Role fit <b>{String(row.role_fit)}</b>
                  </span>
                  <span>
                    Confidence <b>{String(row.evidence_confidence)}</b>
                  </span>
                </div>
                <div>
                  <span className="status-pill">
                    {String(row.recommendation).replaceAll('_', ' ')}
                  </span>
                  <small>
                    {String(row.provider)} · {String(row.provider_status)}
                  </small>
                </div>
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
