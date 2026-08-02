'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dripplex/ui';
import * as React from 'react';

import { useDriverRideStats } from '@/hooks/rides/use-driver-ride-stats';
import { useDriverWallet } from '@/hooks/use-driver-wallet';
import { formatNaira } from '@/lib/format';

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function DashboardStatsCard(): React.JSX.Element {
  const stats = useDriverRideStats();
  const wallet = useDriverWallet();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings & trips</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.isLoading || wallet.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {!stats.isLoading && !wallet.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Today's earnings"
              value={formatNaira(stats.data?.todayEarnings ?? 0)}
            />
            <StatTile label="Today's trips" value={String(stats.data?.todayTrips ?? 0)} />
            <StatTile
              label="This week's earnings"
              value={formatNaira(stats.data?.weekEarnings ?? 0)}
            />
            <StatTile
              label="Wallet balance"
              value={formatNaira(wallet.data?.availableBalance ?? 0)}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
