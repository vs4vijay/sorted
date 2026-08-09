'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function WorkflowRunsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('workflow runs error', error);
  }, [error]);

  return (
    <div className="exec-card exec-empty-state" role="alert">
      <p>
        <b>Something went wrong while loading workflow runs.</b>
      </p>
      <p className="meta">The error has been logged. You can try again.</p>
      <div className="exec-empty-actions">
        <button type="button" className="primary" onClick={reset}>
          Try again
        </button>
        <Link className="secondary" href="/">
          Back to app
        </Link>
      </div>
    </div>
  );
}
