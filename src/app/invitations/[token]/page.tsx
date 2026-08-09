import { hashSessionToken } from '@/lib/auth/session';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { AcceptInvitationForm } from './accept-invitation-form';

const roleLabels = {
  admin: 'administrator',
  recruiter: 'recruiter',
  hiring_manager: 'hiring manager',
  technical_reviewer: 'technical reviewer',
} as const;

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await new OrganizationAccessRepository().findInvitationByTokenHash(
    hashSessionToken(token),
  );
  const available = invitation?.status === 'pending';

  return (
    <main className="setup-page">
      <section className="setup-brand">
        <div className="brand-mark">S</div>
        <span className="eyebrow">SORTED ACCESS</span>
        <h1>{available ? `Join ${invitation.organizationName}` : 'Invitation unavailable'}</h1>
        <p>
          {available
            ? `You were invited as a ${roleLabels[invitation.role]}. Confirm your name to enter this private recruiting workspace.`
            : 'This link is invalid, expired, accepted, or revoked. Ask the workspace administrator for a new invitation.'}
        </p>
      </section>
      <section className="setup-card">
        <span className="eyebrow">HIRING PANEL</span>
        <h2>{available ? invitation.email : 'Access link closed'}</h2>
        {available ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <a className="button secondary" href="/setup">
            Return to setup
          </a>
        )}
      </section>
    </main>
  );
}
