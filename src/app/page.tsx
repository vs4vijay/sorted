import { Suspense } from 'react';
import { SortedApp } from '@/components/sorted-app';

// SortedApp reads ?view=… via useSearchParams, which requires a Suspense boundary.
export default function Home() {
  return (
    <Suspense>
      <SortedApp />
    </Suspense>
  );
}
