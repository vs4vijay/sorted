import type { WorkflowRun } from '../types';
import { formatDateTime, formatDuration } from './format';

/** Key facts about the run, shown next to the timeline. */
export function RunInfoPanel({ run }: { run: WorkflowRun }) {
  const rows: Array<[string, string]> = [
    ['Run', `#${run.number}`],
    ['Workflow', run.workflowName],
    ['Customer', run.customerName ?? '—'],
    ['Trigger', run.trigger],
    ['Started', formatDateTime(run.startedAt)],
  ];

  if (run.endedAt) {
    rows.push(['Finished', formatDateTime(run.endedAt)]);
    rows.push(['Total time', formatDuration(run.endedAt.getTime() - run.startedAt.getTime())]);
  }

  return (
    <section className="exec-card exec-info" aria-label="Run information">
      <div className="exec-card-head">
        <h2>Run information</h2>
      </div>
      <dl className="exec-info-list">
        {rows.map(([label, value]) => (
          <div key={label} className="exec-info-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className="exec-info-row">
          <dt>Run ID</dt>
          <dd>
            <code>{run.id}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
