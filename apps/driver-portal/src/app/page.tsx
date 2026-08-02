'use client';

import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { ActiveTripSummaryCard } from '@/components/ride/active-trip-summary-card';
import { DashboardStatsCard } from '@/components/ride/dashboard-stats-card';
import { IncomingRideModal } from '@/components/ride/incoming-ride-modal';
import { OnlineToggleCard } from '@/components/ride/online-toggle-card';
import { ReferralPromoSummaryCard } from '@/components/ride/referral-promo-summary-card';
import { useRideOfferSocket } from '@/hooks/rides/use-ride-offer-socket';

export default function DashboardPage(): React.JSX.Element {
  useRideOfferSocket();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Go online to start receiving ride requests.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="flex flex-col gap-6">
            <OnlineToggleCard />
            <ActiveTripSummaryCard />
          </div>
          <div className="flex flex-col gap-6">
            <DashboardStatsCard />
            <ReferralPromoSummaryCard />
          </div>
        </div>
      </div>

      <IncomingRideModal />
    </AppShell>
  );
}
