import Link from 'next/link';
import { RUN_STATUS_META } from '../state';
import { RUN_STATUSES, type RunStatus, type WorkflowRunSummary } from '../types';
import { formatDuration, formatRelative } from './format';
import { RunStatusBadge } from './run-status-badge';

/** Status filter chips. Only statuses that actually occur are offered. */
export function RunFilters({
  runs,
  active,
}: {
  runs: WorkflowRunSummary[];
  active: RunStatus | null;
}) {
  const counts = new Map<RunStatus, number>();
  for (const run of runs) {
    counts.set(run.status, (counts.get(run.status) ?? 0) + 1);
  }

  return (
    <nav className="exec-filters" aria-label="Filter runs by status">
      <Link href="/workflows/runs" className={`chip${active === null ? ' chip-active' : ''}`}>
        All <span className="exec-filter-count">{runs.length}</span>
      </Link>
      {RUN_STATUSES.filter((status) => counts.has(status)).map((status) => (
        <Link
          key={status}
          href={`/workflows/runs?status=${status}`}
          className={`chip${active === status ? ' chip-active' : ''}`}
        >
          {RUN_STATUS_META[status].label}{' '}
          <span className="exec-filter-count">{counts.get(status)}</span>
        </Link>
      ))}
    </nav>
  );
}

export function RunList({ runs }: { runs: WorkflowRunSummary[] }) {
  return (
    <ol className="exec-run-list">
      {runs.map((run) => (
        <RunListItem key={run.id} run={run} />
      ))}
    </ol>
  );
}

function RunListItem({ run }: { run: WorkflowRunSummary }) {
  const durationMs = run.endedAt ? run.endedAt.getTime() - run.startedAt.getTime() : null;

  return (
    <li>
      <Link href={`/workflows/runs/${run.id}`} className="exec-run-item">
        <div className="exec-run-item-head">
          <span className="exec-run-item-title">
            <b>#{run.number}</b> {run.workflowName}
          </span>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="exec-run-item-meta">
          {run.customerName && <span>{run.customerName}</span>}
          <span>Started {formatRelative(run.startedAt)}</span>
          <span>
            {run.completedStepCount}/{run.stepCount} steps
          </span>
          {durationMs !== null && <span>{formatDuration(durationMs)}</span>}
        </div>
        {(run.currentStepName || run.statusReason) && (
          <p className="exec-run-item-note">
            {run.status === 'failed' && run.currentStepName
              ? `Failed at: ${run.currentStepName}`
              : run.statusReason ?? `Current step: ${run.currentStepName}`}
          </p>
        )}
      </Link>
    </li>
  );
}
