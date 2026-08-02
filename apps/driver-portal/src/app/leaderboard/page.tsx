import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { LeaderboardTable } from '@/components/campaign/leaderboard-table';

export default function LeaderboardPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            See how you stack up against other drivers this campaign month.
          </p>
        </div>
        <LeaderboardTable />
      </div>
    </AppShell>
  );
}
