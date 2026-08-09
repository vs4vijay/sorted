'use client';

import { useActionState } from 'react';
import { acceptInvitation, type AcceptInvitationState } from './actions';

const initialState: AcceptInvitationState = {};

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);
  return <form action={action} className="setup-form">
    <input type="hidden" name="token" value={token}/>
    <label htmlFor="invitee-name">Your name<input id="invitee-name" name="name" autoComplete="name" required placeholder="Priya Shah"/></label>
    {state.message && <p className="form-error" role="alert">{state.message}</p>}
    <button className="button primary setup-submit" disabled={pending}>{pending ? 'Joining workspace…' : 'Accept and join workspace'}</button>
    <p className="privacy-note">This preview uses the invitation link as identity proof. Production identity verification is still pending.</p>
  </form>;
}
