import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { RewardHistoryList } from '@/components/campaign/reward-history-list';

export default function RewardsPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reward history</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every reward you&apos;ve earned across past campaign months.
          </p>
        </div>
        <RewardHistoryList />
      </div>
    </AppShell>
  );
}
