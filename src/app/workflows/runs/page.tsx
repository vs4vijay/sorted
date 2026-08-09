import type { Metadata } from 'next';
import { AutoRefresh } from '@/features/sorted/workflows/execution/components/auto-refresh';
import { RunFilters, RunList } from '@/features/sorted/workflows/execution/components/run-list';
import { listRuns } from '@/features/sorted/workflows/execution/service';
import { RUN_STATUS_META } from '@/features/sorted/workflows/execution/state';
import { RUN_STATUSES, type RunStatus } from '@/features/sorted/workflows/execution/types';

// PGlite requires the Node.js runtime; execution state must never be cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Workflow runs — Sorted',
};

function parseStatus(value: string | undefined): RunStatus | null {
  return RUN_STATUSES.includes(value as RunStatus) ? (value as RunStatus) : null;
}

export default async function WorkflowRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = parseStatus(status);

  const runs = await listRuns();
  const filtered = activeFilter ? runs.filter((run) => run.status === activeFilter) : runs;
  const hasLiveRun = runs.some((run) => RUN_STATUS_META[run.status].isLive);

  return (
    <>
      <AutoRefresh active={hasLiveRun} />
      <header className="exec-header">
        <div className="exec-header-main">
          <div className="eyebrow">AUTOMATIONS</div>
          <h1>Workflow runs</h1>
          <p className="exec-subtitle">
            Every execution across your workflows — live, waiting for you, and finished.
          </p>
        </div>
      </header>

      <RunFilters runs={runs} active={activeFilter} />

      {filtered.length === 0 ? (
        <div className="exec-card exec-empty-state">
          <p>
            <b>
              {activeFilter
                ? `No ${RUN_STATUS_META[activeFilter].label.toLowerCase()} runs right now.`
                : 'No runs yet.'}
            </b>
          </p>
          <p className="meta">
            Run a workflow from the Workflows screen and its execution will appear here.
          </p>
        </div>
      ) : (
        <RunList runs={filtered} />
      )}
    </>
  );
}
