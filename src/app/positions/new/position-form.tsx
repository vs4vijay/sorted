'use client';
import { useActionState } from 'react';
import { createPosition, type PositionActionState } from '../actions';
export function PositionForm() {
  const [state, action, pending] = useActionState(createPosition, {} as PositionActionState);
  return (
    <form action={action} className="surface form-card">
      <label htmlFor="title">
        Position title
        <input id="title" name="title" required placeholder="e.g. Senior Backend Engineer" />
      </label>
      <div className="form-grid">
        <label htmlFor="location">
          Location
          <input id="location" name="location" placeholder="Bengaluru" />
        </label>
        <label htmlFor="employmentType">
          Employment type
          <select id="employmentType" name="employmentType" defaultValue="Full-time">
            <option>Full-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </label>
        <label htmlFor="workplacePreference">
          Workplace preference
          <select id="workplacePreference" name="workplacePreference" defaultValue="Hybrid">
            <option>Remote</option>
            <option>Hybrid</option>
            <option>On-site</option>
          </select>
        </label>
      </div>
      <label htmlFor="jobDescription">
        Job description <span>Optional</span>
        <textarea
          id="jobDescription"
          name="jobDescription"
          placeholder="Paste the approved job description here…"
          rows={12}
        />
      </label>
      <p className="simulation-label">
        Sarvam-105B structures pasted JDs when configured. If unavailable, the result is clearly
        marked simulated and remains human-reviewed.
      </p>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" disabled={pending}>
          {pending ? 'Structuring rubric…' : 'Create and review rubric'}
        </button>
      </div>
    </form>
  );
}
