'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { CommercialPanel } from '@/components/campaign/commercial-panel';
import { WalletPanel } from '@/components/campaign/wallet-panel';
import { useDriverRideStats } from '@/hooks/rides/use-driver-ride-stats';
import { formatNaira } from '@/lib/format';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

function EarningsBreakdownCard(): React.JSX.Element {
  const stats = useDriverRideStats();
  const [period, setPeriod] = React.useState<PeriodKey>('today');

  const values: Record<PeriodKey, { trips: number; earnings: number }> = {
    today: { trips: stats.data?.todayTrips ?? 0, earnings: stats.data?.todayEarnings ?? 0 },
    week: { trips: stats.data?.weekTrips ?? 0, earnings: stats.data?.weekEarnings ?? 0 },
    month: { trips: stats.data?.monthTrips ?? 0, earnings: stats.data?.monthEarnings ?? 0 },
  };
  const selected = values[period];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setPeriod(option.key);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === option.key
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {stats.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs">Earnings</p>
              <p className="font-display text-2xl font-semibold">
                {formatNaira(selected.earnings)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Trips</p>
              <p className="font-display text-2xl font-semibold">{selected.trips}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EarningsPage(): React.JSX.Element {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your trip earnings, wallet balance, and rewards.
          </p>
        </div>

        <EarningsBreakdownCard />
        <WalletPanel />
        <CommercialPanel />

        <Card>
          <CardHeader>
            <CardTitle>Referral & promotion rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Driver Growth Campaign rewards (referral and tier bonuses) show up in your wallet
              transactions above.{' '}
              <Link href="/campaign" className="text-primary font-medium">
                View campaign progress
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Self-service withdrawal requests aren&apos;t available yet — there&apos;s no payout
              endpoint in the backend to request one. Your available balance above is accurate;
              reach out to support for a manual payout in the meantime.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
