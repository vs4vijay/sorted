'use client';
import { useActionState } from 'react';
import { completeSetup, type SetupState } from './actions';
const initialState: SetupState = {};
export function SetupForm() {
  const [state, action, pending] = useActionState(completeSetup, initialState);
  return <form action={action} className="setup-form">
    <div className="form-grid"><label>Your name<input name="name" autoComplete="name" required placeholder="Ananya Rao" /></label><label>Work email<input name="email" type="email" autoComplete="email" required placeholder="ananya@company.in" /></label></div>
    <label>Organization name<input name="organizationName" required placeholder="Acme India" /></label>
    <label>Workspace URL<span>Use lowercase letters, numbers, and hyphens.</span><div className="slug-field"><span>sorted.app/</span><input name="organizationSlug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="acme-india" /></div></label>
    <input type="hidden" name="timezone" value="Asia/Kolkata"/><input type="hidden" name="defaultLocale" value="en-IN"/>
    {state.message && <p className="form-error" role="alert">{state.message}</p>}
    <button className="button primary setup-submit" disabled={pending}>{pending ? 'Creating workspace…' : 'Create recruiting workspace'}</button>
    <p className="privacy-note">Your workspace starts private. Candidate data is visible only to approved members.</p>
  </form>;
}
