'use client';

import { useActionState } from 'react';
import { acceptInvitation, type AcceptInvitationState } from './actions';

const initialState: AcceptInvitationState = {};

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return <form action={action} className="setup-form">
    <input type="hidden" name="token" value={token}/>
    <label htmlFor="invitee-name">Your name<input id="invitee-name" name="name" autoComplete="name" required placeholder="Priya Shah"/></label>
    <label htmlFor="invitee-password">Create password<span>Use at least 12 characters with a letter and number.</span><input id="invitee-password" name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
    {state.message && <p className="form-error" role="alert">{state.message}</p>}
    <button className="button primary setup-submit" disabled={pending}>{pending ? 'Joining workspace…' : 'Accept and join workspace'}</button>
    <p className="privacy-note">The single-use invitation link verifies access. Your password is stored only as a secure hash.</p>
  </form>;
}
