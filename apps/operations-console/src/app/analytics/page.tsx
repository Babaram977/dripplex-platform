'use client';

import { EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsKpiTile } from '@/components/analytics-kpi-tile';
import { AnalyticsRangePicker } from '@/components/analytics-range-picker';
import { AppShell } from '@/components/app-shell';
import { useAnalyticsOverview } from '@/hooks/use-operations-analytics';
import {
  formatCount,
  formatDurationSeconds,
  formatPercent,
  formatRateOrDash,
} from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

/**
 * DPX-OPS-001 Slice 4 — Operations Analytics overview. Follows the
 * founder's own six-question framing, left to right: how busy → are rides
 * fulfilled → are drivers utilized → is dispatch performing → is
 * Operations responding → where is demand. A small, fixed set of KPIs —
 * each tile is a doorway into its own drill-down page, not a decorative
 * dashboard. Time-range filtering is fundamental, per the founder's own
 * instruction: the picker sits at the top and every number below reads
 * from the same selected range.
 */
export default function AnalyticsOverviewPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const overviewQuery = useAnalyticsOverview(range);
  const overview = overviewQuery.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Real operational data, not a generic dashboard — every number below is queried live
              for the selected range.
            </p>
          </div>
          <AnalyticsRangePicker value={range} onChange={setRange} />
        </div>

        {overviewQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading analytics…" />
          </div>
        ) : null}

        {overviewQuery.isError ? (
          <EmptyState
            title="Couldn't load analytics"
            description="Check your connection and try again."
          />
        ) : null}

        {overview ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AnalyticsKpiTile
              label="Rides requested"
              value={formatCount(overview.ridesRequested)}
              hint="How busy are we?"
              href="/analytics/rides"
            />
            <AnalyticsKpiTile
              label="Completion rate"
              value={formatPercent(overview.completionRate)}
              hint={`${formatPercent(overview.cancellationRate)} cancelled · ${formatPercent(overview.noDriversFoundRate)} no drivers found`}
              href="/analytics/rides"
            />
            <AnalyticsKpiTile
              label="Driver utilization"
              value={formatRateOrDash(overview.averageUtilizationRate)}
              hint={`${formatCount(overview.onlineDriversNow)} online now · ${formatCount(overview.activeDriversInRange)} active in range`}
              href="/analytics/drivers"
            />
            <AnalyticsKpiTile
              label="Time to accept"
              value={formatDurationSeconds(overview.averageTimeToAcceptSeconds)}
              hint={`${formatPercent(overview.repeatedOfferRideRate)} of rides needed repeated offers`}
              href="/analytics/dispatch"
            />
            <AnalyticsKpiTile
              label="Time to first response"
              value={formatDurationSeconds(overview.averageTimeToFirstResponseSeconds)}
              hint={`${formatCount(overview.openCasesCount)} open cases right now`}
              href="/analytics/response"
            />
            <AnalyticsKpiTile
              label="Demand map"
              value="View"
              hint="Where rides are requested"
              href="/analytics/geography"
            />
          </div>
        ) : null}

        {overview ? (
          <p className="text-muted-foreground text-xs">
            Range: {new Date(overview.range.from).toLocaleString('en-NG')} –{' '}
            {new Date(overview.range.to).toLocaleString('en-NG')}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
