import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { WorkflowExecution } from '@/features/sorted/workflows/execution/components/workflow-execution';
import { getRun } from '@/features/sorted/workflows/execution/service';

// PGlite requires the Node.js runtime; execution state must never be cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deduplicates the read between generateMetadata and the page render. */
const getRunCached = cache((runId: string) => getRun(runId));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  const { runId } = await params;
  const detail = await getRunCached(runId);
  if (!detail) return { title: 'Run not found — Sorted' };
  return { title: `Run #${detail.run.number} · ${detail.run.workflowName} — Sorted` };
}

export default async function WorkflowRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const detail = await getRunCached(runId);

  if (!detail) notFound();

  return <WorkflowExecution detail={detail} />;
}
