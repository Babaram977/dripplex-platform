import * as React from 'react';

export default function DashboardLoading(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
      <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
      <div className="bg-muted h-24 w-full animate-pulse rounded-lg" />
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
