import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { AvailabilityToggle } from '@/components/rider/availability-toggle';
import { JobList } from '@/components/rider/job-list';

export default function DashboardPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Deliveries</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your assigned delivery jobs and their lifecycle actions.
          </p>
        </div>
        <AvailabilityToggle />
        <JobList />
      </div>
    </AppShell>
  );
}
