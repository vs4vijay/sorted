import Link from 'next/link';
import type { WorkflowRun } from '../types';
import { formatRelative } from './format';
import { RunStatusBadge } from './run-status-badge';

export function ExecutionHeader({ run }: { run: WorkflowRun }) {
  return (
    <header className="exec-header">
      <div className="exec-header-main">
        <div className="eyebrow">
          <Link href="/workflows/runs" className="exec-crumb">
            Workflow runs
          </Link>
          {' / '}Run #{run.number}
        </div>
        <h1>{run.workflowName}</h1>
        <div className="exec-header-meta">
          <RunStatusBadge status={run.status} />
          {run.customerName && <span>{run.customerName}</span>}
          <span>{run.trigger}</span>
          <span>Started {formatRelative(run.startedAt)}</span>
          {run.simulated && (
            <span className="exec-sim-chip" title="Execution is simulated in this prototype">
              Simulated
            </span>
          )}
        </div>
      </div>
      <div className="top-actions">
        {run.conversationId && (
          <Link className="secondary" href="/?view=inbox">
            View conversation
          </Link>
        )}
        <Link className="secondary" href="/workflows/runs">
          All runs
        </Link>
      </div>
    </header>
  );
}
