'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useRideOperationsAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount, formatPercent } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

/** DPX-OPS-001 Slice 4 — Ride Operations drill-down. `NO_DRIVERS_FOUND` is
 * kept structurally separate from cancellations throughout, never folded
 * in — the same distinction Slice 3's ride detail view established.
 * `cancelledBySystem` is shown as-is: it is genuinely always 0 today
 * (`RideCancelledBy.SYSTEM` has zero real call sites platform-wide), and
 * this screen reports that honestly rather than hiding the row.
 * `cancelledByOperations` is the support desk clearing a stranded ride from
 * the console — a human decision, kept off the System row for that reason. */
export default function RideOperationsAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useRideOperationsAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Ride Operations"
          description="Demand, completion, and cancellation — every ride requested in the selected range."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading ride operations…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load ride operations"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Requested', value: formatCount(data.requested) },
                {
                  label: 'Completed',
                  value: `${formatCount(data.completed)} (${formatPercent(data.completionRate)})`,
                },
                {
                  label: 'Cancelled',
                  value: `${formatCount(data.cancelled)} (${formatPercent(data.cancellationRate)})`,
                },
                {
                  label: 'No drivers found',
                  value: `${formatCount(data.noDriversFound)} (${formatPercent(data.noDriversFoundRate)})`,
                },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Cancelled by</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsStatGrid
                  stats={[
                    { label: 'Customer', value: formatCount(data.cancelledByCustomer) },
                    { label: 'Driver', value: formatCount(data.cancelledByDriver) },
                    { label: 'System', value: formatCount(data.cancelledBySystem) },
                    { label: 'Operations', value: formatCount(data.cancelledByOperations) },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By ride type</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byRideType.length === 0 ? (
                  <EmptyState
                    title="No rides in this range"
                    description="Try a wider time range."
                  />
                ) : (
                  <ul className="divide-border/70 divide-y">
                    {data.byRideType.map((row) => (
                      <li
                        key={row.rideType}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <span className="font-medium">{row.rideType}</span>
                        <span className="text-muted-foreground flex gap-x-3 text-xs">
                          <span>{formatCount(row.requested)} requested</span>
                          <span>{formatCount(row.completed)} completed</span>
                          <span>{formatCount(row.cancelled)} cancelled</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Demand by day</CardTitle>
              </CardHeader>
              <CardContent>
                {data.demandSeries.length === 0 ? (
                  <EmptyState
                    title="No rides in this range"
                    description="Try a wider time range."
                  />
                ) : (
                  <ul className="divide-border/70 divide-y">
                    {data.demandSeries.map((point) => (
                      <li
                        key={point.bucketStart}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{point.bucketStart}</span>
                        <span className="font-medium tabular-nums">{formatCount(point.count)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {data.topCancellationReasons.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Top cancellation reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-border/70 divide-y">
                    {data.topCancellationReasons.map((row) => (
                      <li
                        key={row.reason}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span>{row.reason}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatCount(row.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
