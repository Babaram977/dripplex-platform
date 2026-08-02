import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { DriverEducation } from '@/components/campaign/driver-education';

export default function LearnPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Referral campaign guide
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Rules, qualification criteria, and answers to common questions.
          </p>
        </div>
        <DriverEducation />
      </div>
    </AppShell>
  );
}
