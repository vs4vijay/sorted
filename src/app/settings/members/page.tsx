import { redirect } from 'next/navigation';
import { AppShell, PageHeader } from '@/components/recruiting/app-shell';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import { roleCan } from '@/features/organizations/schemas/access';
import { getCurrentAccess } from '@/lib/auth/session';
import { revokeInvitation, updateMemberRole } from './actions';
import { InviteMemberForm } from './invite-form';

const labels = {
  admin: 'Administrator',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  technical_reviewer: 'Technical reviewer',
} as const;

export default async function MembersPage() {
  const access = await getCurrentAccess();
  if (!access) redirect('/setup');
  const repository = new OrganizationAccessRepository();
  const [members, invitations] = await Promise.all([
    repository.listMembers(access.organization.id, access.userId),
    repository.listInvitations(access.organization.id),
  ]);
  const canManage = roleCan(access.membership.role, 'members:manage');
  return (
    <AppShell active="settings">
      <PageHeader
        eyebrow="WORKSPACE ACCESS"
        title="Hiring panel"
        description={`Manage who can access ${access.organization.name} and what they can do.`}
      />
      <div className="members-layout">
        <section className="members-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ACTIVE MEMBERS</span>
              <h2>
                {members.length} workspace member{members.length === 1 ? '' : 's'}
              </h2>
            </div>
          </div>
          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.id}>
                <div className="avatar sm">
                  {member.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="member-identity">
                  <strong>
                    {member.name}
                    {member.isCurrentUser && <small> You</small>}
                  </strong>
                  <span>{member.email}</span>
                </div>
                {canManage && !member.isCurrentUser ? (
                  <form action={updateMemberRole}>
                    <input type="hidden" name="membershipId" value={member.id} />
                    <select
                      name="role"
                      defaultValue={member.role}
                      aria-label={`Role for ${member.name}`}
                    >
                      <option value="admin">Administrator</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="hiring_manager">Hiring manager</option>
                      <option value="technical_reviewer">Technical reviewer</option>
                    </select>
                    <button className="button secondary">Save</button>
                  </form>
                ) : (
                  <span className="role-pill">{labels[member.role]}</span>
                )}
              </div>
            ))}
          </div>
        </section>
        <aside className="members-card invite-card">
          <span className="eyebrow">ADD TO PANEL</span>
          <h2>Invite a teammate</h2>
          <p>
            Invitations expire after seven days. Email delivery is simulated until a provider is
            configured.
          </p>
          {canManage ? (
            <InviteMemberForm />
          ) : (
            <div className="permission-note">
              Only workspace administrators can invite members or change roles.
            </div>
          )}
        </aside>
      </div>
      <section className="members-card pending-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INVITATIONS</span>
            <h2>Pending access</h2>
          </div>
        </div>
        {invitations.length ? (
          <div className="member-list">
            {invitations.map((invitation) => (
              <div className="member-row" key={invitation.id}>
                <div className="member-identity">
                  <strong>{invitation.email}</strong>
                  <span>
                    {labels[invitation.role]} · expires{' '}
                    {invitation.expiresAt.toLocaleDateString('en-IN')}
                  </span>
                </div>
                <span className={`pill ${invitation.status === 'pending' ? 'amber' : ''}`}>
                  {invitation.status}
                </span>
                {canManage && invitation.status === 'pending' && (
                  <form action={revokeInvitation}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <button className="button secondary">Revoke</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            No invitations yet. Prepare one to add your hiring manager, recruiter, or technical
            reviewer.
          </p>
        )}
      </section>
    </AppShell>
  );
}
