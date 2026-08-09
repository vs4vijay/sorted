import { notFound } from 'next/navigation';
import { CandidatePrivacyRepository } from '@/features/candidates/repositories/candidate-privacy-repository';
import { PrivacyRequestForm } from './privacy-request-form';
export const dynamic = 'force-dynamic';
export default async function CandidatePrivacyPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();
  const access = await new CandidatePrivacyRepository().resolveHostedAccess(token);
  if (!access) notFound();
  return (
    <main className="privacy-portal">
      <header className="portal-brand">
        <span className="brand-mark">S</span>
        <span>Sorted</span>
      </header>
      <section className="portal-card">
        <span className="eyebrow">CANDIDATE PRIVACY</span>
        <h1>Your information, your choice</h1>
        <p>
          Hello {String(access.display_name)}. {String(access.organization_name)} uses Sorted to
          support human recruiting decisions. You can ask to correct, export or delete your
          information, and stop recruiting emails at any time.
        </p>
        <div className="portal-principles">
          <span>
            <strong>Human reviewed</strong>Requests are verified by the hiring team.
          </span>
          <span>
            <strong>Auditable</strong>We keep a record of actions taken.
          </span>
          <span>
            <strong>No auto-rejection</strong>This form never changes a hiring decision.
          </span>
        </div>
        <PrivacyRequestForm token={token} emailOptedOut={Boolean(access.email_opted_out)} />
      </section>
      <footer>
        Need help? Reply to the hiring team that shared this secure link. Never share this link with
        anyone else.
      </footer>
    </main>
  );
}
