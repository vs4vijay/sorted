import Link from 'next/link';
import { AppShell, CandidateAvatar, PageHeader } from '@/components/recruiting/app-shell';
import { requirePageAccess } from '@/lib/auth/session';
import { roleCan } from '@/features/organizations/schemas/access';
import { PanelReviewRepository } from '@/features/panel-reviews/repositories/panel-review-repository';

export default async function ReviewsPage() {
  const access = await requirePageAccess('reviews:submit');
  const canDecide = roleCan(access.membership.role, 'shortlist:decide');
  const rows = await new PanelReviewRepository().queue(
    access.organization.id,
    access.membership.id,
    canDecide,
  );
  return (
    <AppShell active="reviews">
      <PageHeader
        eyebrow="HUMAN REVIEW"
        title="Panel review queue"
        description="Reviewers assess evidence independently. AI recommendations remain advisory and never advance a candidate."
      />
      <section className="surface review-queue">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h2>No reviews assigned</h2>
            <p>Your evidence review queue is clear.</p>
          </div>
        ) : (
          rows.map((row, index) => (
            <Link
              className="review-queue-row"
              href={`/reviews/${row.evaluation_id}`}
              key={String(row.evaluation_id)}
            >
              <CandidateAvatar
                initials={String(row.display_name)
                  .split(/\s+/)
                  .map((v) => v[0])
                  .join('')
                  .slice(0, 2)}
                index={index}
              />
              <div>
                <h3>{String(row.display_name)}</h3>
                <p>
                  {String(row.position_title)} · rubric v{String(row.rubric_version)}
                </p>
              </div>
              <div className="review-score">
                <strong>{String(row.role_fit)}</strong>
                <span>role fit</span>
              </div>
              <span className={`stage ${String(row.review_state)}`}>
                {String(row.review_state).replaceAll('_', ' ')}
              </span>
              <small>
                {String(row.submitted_count)}/{String(row.assigned_count)} reviews
              </small>
              <b>→</b>
            </Link>
          ))
        )}
      </section>
    </AppShell>
  );
}
