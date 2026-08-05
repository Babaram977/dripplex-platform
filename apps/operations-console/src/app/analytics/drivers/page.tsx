'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatNaira } from '@dripplex/utils';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useDriverUtilizationAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount, formatDurationSeconds, formatRateOrDash } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

/** DPX-OPS-001 Slice 4 — Driver Utilization drill-down. "Online seconds"
 * is shift time (`DriverShift`), the real queryable proxy the reality
 * audit confirmed exists — not raw `DriverAvailability.online` time. */
export default function DriverUtilizationAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useDriverUtilizationAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Driver Utilization"
          description="Shift time, completed trips, earnings, and how much of a driver's shift is spent on a trip."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading driver utilization…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load driver utilization"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Drivers active in range', value: formatCount(data.driverCount) },
                { label: 'Trips completed', value: formatCount(data.totalTripsCompleted) },
                { label: 'Total earnings', value: formatNaira(data.totalEarnings) },
                {
                  label: 'Fleet-wide utilization',
                  value: formatRateOrDash(data.averageUtilizationRate),
                },
                {
                  label: 'Total online time',
                  value: formatDurationSeconds(data.totalOnlineSeconds),
                },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Top drivers by trips completed</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topDrivers.length === 0 ? (
                  <EmptyState
                    title="No driver activity in this range"
                    description="No shifts or completed trips were recorded in the selected range."
                  />
                ) : (
                  <ul className="divide-border/70 divide-y">
                    {data.topDrivers.map((driver) => (
                      <li
                        key={driver.driverId}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <span className="font-medium">{driver.driverName}</span>
                        <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                          <span>{formatCount(driver.tripsCompleted)} trips</span>
                          <span>{formatNaira(driver.earnings)}</span>
                          <span>{formatDurationSeconds(driver.onTripSeconds)} on trip</span>
                          <span>{formatDurationSeconds(driver.onlineSeconds)} online</span>
                          <span>{formatRateOrDash(driver.utilizationRate)} utilized</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
