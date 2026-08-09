'use client';
import { useActionState } from 'react';
import { submitHostedPrivacyRequest, type HostedPrivacyState } from './actions';
const initial: HostedPrivacyState = {};
export function PrivacyRequestForm({
  token,
  emailOptedOut,
}: {
  token: string;
  emailOptedOut: boolean;
}) {
  const action = submitHostedPrivacyRequest.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initial);
  if (state.success)
    return (
      <div className="portal-success" role="status">
        <span aria-hidden="true">✓</span>
        <h2>Request received</h2>
        <p>{state.success}</p>
      </div>
    );
  return (
    <form action={formAction} className="portal-form">
      <fieldset>
        <legend>What would you like us to do?</legend>
        <label>
          <input type="radio" name="requestType" value="correction" /> Correct information in my
          profile
        </label>
        <label>
          <input type="radio" name="requestType" value="export" /> Send me a copy of my data
        </label>
        <label>
          <input type="radio" name="requestType" value="deletion" /> Delete or anonymize my data
        </label>
      </fieldset>
      <label className="portal-opt-out">
        <input type="checkbox" name="optOutEmail" disabled={emailOptedOut} />
        <span>
          <strong>
            {emailOptedOut ? 'Email outreach is already stopped' : 'Stop email outreach'}
          </strong>
          <small>You will not receive further recruiting emails from this workspace.</small>
        </span>
      </label>
      <label htmlFor="details">Tell the hiring team what you need</label>
      <textarea
        id="details"
        name="details"
        required
        minLength={10}
        maxLength={1000}
        placeholder="For example: Please correct my current location to Pune."
      />
      <p className="portal-note">
        Export, correction and deletion requests are verified and completed by a person. This
        request will not make a hiring decision.
      </p>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button className="button primary" disabled={pending}>
        {pending ? 'Submitting securely…' : 'Submit request'}
      </button>
    </form>
  );
}
