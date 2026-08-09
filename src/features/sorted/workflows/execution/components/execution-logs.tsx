import { Fragment } from 'react';
import { EVENT_LEVEL_SYMBOL } from '../state';
import type { WorkflowRun, WorkflowRunEvent } from '../types';
import { formatClockTime } from './format';

const VISIBLE_EVENT_COUNT = 30;

/**
 * Chronological, business-readable execution log. Technical details
 * (ids, metadata, structured errors) sit behind a per-entry disclosure so
 * they never overwhelm the default reading experience. Older entries of
 * long logs are collapsed rather than rendered as one endless list.
 */
export function ExecutionLogs({ run, events }: { run: WorkflowRun; events: WorkflowRunEvent[] }) {
  const stepNames = new Map(run.steps.map((step) => [step.id, step.name]));
  const earlier = events.length > VISIBLE_EVENT_COUNT ? events.slice(0, events.length - VISIBLE_EVENT_COUNT) : [];
  const visible = events.slice(earlier.length);

  return (
    <section className="exec-card" aria-label="Execution log">
      <div className="exec-card-head">
        <h2>Execution log</h2>
        <span className="meta">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <p className="exec-empty">Nothing has been logged for this run yet.</p>
      ) : (
        <ol className="exec-log">
          {earlier.length > 0 && (
            <li className="exec-log-earlier">
              <details>
                <summary>Show {earlier.length} earlier events</summary>
                <ol className="exec-log">
                  <LogEntries events={earlier} stepNames={stepNames} />
                </ol>
              </details>
            </li>
          )}
          <LogEntries events={visible} stepNames={stepNames} />
        </ol>
      )}
    </section>
  );
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Step reference for an entry, unless it would just repeat the title. */
function stepNameFor(event: WorkflowRunEvent, stepNames: Map<string, string>): string | undefined {
  const name = event.stepId ? stepNames.get(event.stepId) : undefined;
  return name && name !== event.title ? name : undefined;
}

function LogEntries({
  events,
  stepNames,
}: {
  events: WorkflowRunEvent[];
  stepNames: Map<string, string>;
}) {
  return (
    <>
      {events.map((event, index) => {
        const day = formatDay(event.at);
        const showDay = index === 0 || day !== formatDay(events[index - 1].at);

        return (
          <Fragment key={event.id}>
            {showDay && (
              <li className="exec-log-day" aria-hidden="true">
                {day}
              </li>
            )}
            <LogEntry event={event} stepName={stepNameFor(event, stepNames)} />
          </Fragment>
        );
      })}
    </>
  );
}

function LogEntry({ event, stepName }: { event: WorkflowRunEvent; stepName?: string }) {
  const technical = {
    event_id: event.id,
    run_id: event.runId,
    step_id: event.stepId,
    seq: event.seq,
    type: event.type,
    level: event.level,
    at: event.at.toISOString(),
    metadata: event.metadata,
  };

  return (
    <li className={`exec-log-entry exec-log-${event.level}`}>
      <time dateTime={event.at.toISOString()}>{formatClockTime(event.at)}</time>
      <span className="exec-log-symbol" aria-hidden="true">
        {EVENT_LEVEL_SYMBOL[event.level]}
      </span>
      <div className="exec-log-body">
        <p className="exec-log-title">
          <b>{event.title}</b>
          {stepName && <span className="meta"> · {stepName}</span>}
        </p>
        {event.description && <p className="exec-log-description">{event.description}</p>}
        <details className="exec-log-technical">
          <summary>Technical details</summary>
          <pre>{JSON.stringify(technical, null, 2)}</pre>
        </details>
      </div>
    </li>
  );
}
