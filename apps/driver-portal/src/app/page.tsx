import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { CampaignProgressCard } from '@/components/campaign/campaign-progress-card';
import { ReferralCodeCard } from '@/components/campaign/referral-code-card';

export default function DashboardPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Driver Growth Campaign
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Invite passengers, unlock tiers, and earn a monthly reward.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <ReferralCodeCard />
          <CampaignProgressCard />
        </div>
      </div>
    </AppShell>
  );
}
