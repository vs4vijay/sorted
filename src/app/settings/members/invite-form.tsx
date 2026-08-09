'use client';

import { useActionState } from 'react';
import { inviteMember, type MemberActionState } from './actions';

const initialState: MemberActionState = {};

export function InviteMemberForm() {
  const [state, action, pending] = useActionState(inviteMember, initialState);
  return (
    <form action={action} className="member-invite-form">
      <div>
        <label htmlFor="invite-email">Work email</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="reviewer@company.in"
        />
      </div>
      <div>
        <label htmlFor="invite-role">Panel role</label>
        <select id="invite-role" name="role" defaultValue="technical_reviewer">
          <option value="recruiter">Recruiter</option>
          <option value="hiring_manager">Hiring manager</option>
          <option value="technical_reviewer">Technical reviewer</option>
        </select>
      </div>
      <button className="button primary" disabled={pending}>
        {pending ? 'Preparing…' : 'Prepare invitation'}
      </button>
      {state.message && (
        <p className={state.status === 'success' ? 'form-success' : 'form-error'} role="status">
          {state.message}
        </p>
      )}
      {state.acceptanceUrl && (
        <a className="button secondary" href={state.acceptanceUrl}>
          Open simulated invitation
        </a>
      )}
    </form>
  );
}
