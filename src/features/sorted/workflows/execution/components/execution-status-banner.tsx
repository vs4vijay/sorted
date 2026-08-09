import { currentStep, RUN_STATUS_META } from '../state';
import type { WorkflowRun } from '../types';

/**
 * One glance answers: what state is this run in, and what should I do?
 * The live region announces state changes to assistive technology when the
 * page refreshes while a run progresses.
 */
export function ExecutionStatusBanner({ run }: { run: WorkflowRun }) {
  const meta = RUN_STATUS_META[run.status];
  const step = currentStep(run);

  return (
    <section
      className={`exec-banner exec-tone-${meta.tone}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="exec-banner-head">
        <span className="exec-banner-symbol" aria-hidden="true">
          {meta.symbol}
        </span>
        <h2>{meta.label}</h2>
      </div>
      <p>{run.statusReason ?? meta.explanation}</p>
      {step && run.status !== 'completed' && run.status !== 'cancelled' && (
        <p className="exec-banner-step">
          {run.status === 'failed' ? 'Failed at: ' : 'Current step: '}
          <b>{step.name}</b>
          {run.status === 'failed' && step.error ? ` — ${step.error.message}` : ''}
        </p>
      )}
    </section>
  );
}
