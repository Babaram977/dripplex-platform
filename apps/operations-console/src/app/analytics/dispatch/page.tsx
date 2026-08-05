'use client';

import { EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useDispatchPerformanceAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount, formatDurationSeconds, formatPercent } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

/** DPX-OPS-001 Slice 4 — Dispatch Performance drill-down, aggregated from
 * the same `RideOffer` data Slice 3's per-ride allocation history and
 * `computeDispatchExceptions()` repeated-offer-failure category already
 * read one ride at a time. */
export default function DispatchPerformanceAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useDispatchPerformanceAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Dispatch Performance"
          description="Offer volumes, acceptance/decline outcomes, time-to-accept, and repeated offer failures."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading dispatch performance…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load dispatch performance"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Total offers', value: formatCount(data.totalOffers) },
                { label: 'Accepted', value: formatCount(data.acceptedOffers) },
                { label: 'Declined', value: formatCount(data.declinedOffers) },
                { label: 'Expired', value: formatCount(data.expiredOffers) },
                { label: 'Acceptance rate', value: formatPercent(data.acceptanceRate) },
              ]}
            />
            <AnalyticsStatGrid
              stats={[
                {
                  label: 'Time to accept',
                  value: formatDurationSeconds(data.averageTimeToAcceptSeconds),
                },
                { label: 'Rides with offers', value: formatCount(data.ridesWithOffers) },
                {
                  label: 'Needed repeated offers',
                  value: formatCount(data.ridesNeedingRepeatedOffers),
                },
                { label: 'Repeated-offer rate', value: formatPercent(data.repeatedOfferRate) },
                {
                  label: 'Avg. offers per ride',
                  value:
                    data.averageOffersPerRide === null ? '—' : data.averageOffersPerRide.toFixed(1),
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
