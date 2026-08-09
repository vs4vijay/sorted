'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { completeSetup, type SetupState } from './actions';

const initialState: SetupState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <span className="field-error" role="alert">
      {messages[0]}
    </span>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(completeSetup, initialState);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="setup-form" noValidate>
      <div className="form-grid">
        <label>
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
          />
          <FieldError messages={errors.name} />
        </label>
        <label>
          Work email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@yourcompany.in"
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError messages={errors.email} />
        </label>
      </div>
      <label>
        Organization name
        <input
          name="organizationName"
          required
          placeholder="Your company"
          aria-invalid={Boolean(errors.organizationName)}
        />
        <FieldError messages={errors.organizationName} />
      </label>
      <label>
        Password
        <span>Use at least 12 characters with a letter and number.</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-invalid={Boolean(errors.password)}
        />
        <FieldError messages={errors.password} />
      </label>
      <label>
        Workspace URL
        <span>Use lowercase letters, numbers, and hyphens.</span>
        <div className="slug-field">
          <span>sorted.app/</span>
          <input
            name="organizationSlug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="your-company"
            aria-invalid={Boolean(errors.organizationSlug)}
          />
        </div>
        <FieldError messages={errors.organizationSlug} />
      </label>
      <input type="hidden" name="timezone" value="Asia/Kolkata" />
      <input type="hidden" name="defaultLocale" value="en-IN" />
      {state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
      <button className="button primary setup-submit" disabled={pending}>
        {pending ? 'Creating workspace…' : 'Create recruiting workspace'}
      </button>
      <Link className="auth-link" href="/sign-in">
        Already have an account? Sign in
      </Link>
      <p className="privacy-note">
        Your workspace starts private. Candidate data is visible only to approved members.
      </p>
    </form>
  );
}
