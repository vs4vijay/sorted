'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keeps the page in sync with server-side execution state.
 *
 * While a run is live (queued/running) the server component tree is
 * refreshed on an interval — the simulated executor advances state on read,
 * and a future realtime channel (e.g. Postgres LISTEN/NOTIFY pushed over
 * SSE) can replace this polling without touching any other component.
 * Nothing here fakes progress: the client only re-reads persisted state.
 */
export function AutoRefresh({ active, intervalMs = 2500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (!document.hidden) router.refresh();
    };

    window.addEventListener('focus', refreshIfVisible);
    if (!active) {
      return () => window.removeEventListener('focus', refreshIfVisible);
    }

    const id = window.setInterval(refreshIfVisible, intervalMs);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [active, intervalMs, router]);

  return null;
}
