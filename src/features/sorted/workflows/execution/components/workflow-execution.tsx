import type { RunDetail } from '../service';
import { RUN_STATUS_META } from '../state';
import { AutoRefresh } from './auto-refresh';
import { ExecutionActions } from './execution-actions';
import { ExecutionHeader } from './execution-header';
import { ExecutionLogs } from './execution-logs';
import { ExecutionStatusBanner } from './execution-status-banner';
import { ExecutionTimeline } from './execution-timeline';
import { RunInfoPanel } from './run-info-panel';
import { SimulationNote } from './simulation-note';

/**
 * The control center for one workflow run: header, current state, step
 * timeline, contextual actions and the audit log. Reusable — embed it
 * anywhere a run needs to be shown (run page today; inbox/dashboard later).
 */
export function WorkflowExecution({ detail }: { detail: RunDetail }) {
  const { run, events } = detail;

  return (
    <>
      <AutoRefresh active={RUN_STATUS_META[run.status].isLive} />
      <ExecutionHeader run={run} />
      <ExecutionStatusBanner run={run} />
      <div className="exec-grid">
        <ExecutionTimeline run={run} />
        <div className="exec-side">
          <ExecutionActions runId={run.id} status={run.status} />
          <RunInfoPanel run={run} />
          <SimulationNote />
        </div>
      </div>
      <ExecutionLogs run={run} events={events} />
    </>
  );
}
