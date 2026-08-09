import { STEP_KIND_LABEL, STEP_STATUS_META, stepDurationMs } from '../state';
import type { WorkflowRunStep } from '../types';
import { formatClockTime, formatDuration } from './format';

interface SideEffectOutcome {
  kind: string;
  description: string;
  status: string;
}

/** Side-effect outcomes recorded by the executor on step completion. */
function sideEffectsOf(step: WorkflowRunStep): SideEffectOutcome[] {
  const value = step.output?.side_effects;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SideEffectOutcome =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SideEffectOutcome).description === 'string' &&
      typeof (item as SideEffectOutcome).status === 'string',
  );
}

/**
 * One row of the execution timeline: marker, name, who performs it, state,
 * timing, business-readable result and (behind a disclosure) structured
 * output or error details.
 */
export function ExecutionStep({
  step,
  isCurrent,
  isLast,
}: {
  step: WorkflowRunStep;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const meta = STEP_STATUS_META[step.status];
  const duration = stepDurationMs(step);
  const draft = typeof step.output?.draft === 'string' ? step.output.draft : null;
  const sideEffects = sideEffectsOf(step);

  return (
    <li
      className={`exec-step exec-step-${step.status}${isCurrent ? ' exec-step-current' : ''}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <div className="exec-step-rail" aria-hidden="true">
        <span className={`exec-step-marker exec-tone-${meta.tone}`}>{meta.symbol}</span>
        {!isLast && <span className="exec-step-line" />}
      </div>

      <div className="exec-step-body">
        <div className="exec-step-head">
          <span className="exec-step-name">{step.name}</span>
          <span className={`exec-step-state exec-text-${meta.tone}`}>{meta.label}</span>
        </div>

        <div className="exec-step-meta">
          <span>{STEP_KIND_LABEL[step.kind]}</span>
          {step.actor && <span>· {step.actor}</span>}
          {step.startedAt && <span>· {formatClockTime(step.startedAt)}</span>}
          {duration !== null && duration > 0 && <span>· {formatDuration(duration)}</span>}
          {step.attempts > 1 && <span>· attempt {step.attempts}</span>}
        </div>

        {step.summary && <p className="exec-step-summary">{step.summary}</p>}

        {draft && (
          <blockquote className="exec-step-draft" lang="hi">
            {draft}
          </blockquote>
        )}

        {sideEffects.length > 0 && (
          <ul className="exec-step-effects" aria-label="Side effects">
            {sideEffects.map((effect) => (
              <li key={effect.kind}>
                {effect.description} <span className="exec-step-effect-status">{effect.status}</span>
              </li>
            ))}
          </ul>
        )}

        {step.error && (
          <div className="exec-step-error">
            <p>
              <b>{step.error.message}</b>
            </p>
            <p className="exec-step-error-code">Error code: {step.error.code}</p>
            {step.error.details && (
              <details>
                <summary>Technical details</summary>
                <pre>{step.error.details}</pre>
              </details>
            )}
          </div>
        )}

        {step.output && !step.error && (
          <details className="exec-step-output">
            <summary>Step output</summary>
            <pre>{JSON.stringify(step.output, null, 2)}</pre>
          </details>
        )}
      </div>
    </li>
  );
}
