'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useGeographicDemandAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

/**
 * DPX-OPS-001 Slice 4 — Geographic Activity drill-down: historical
 * pickup/drop-off demand, from real `Ride` coordinates. No named regions —
 * grid cells only, per the standing decision (Slice 2, reaffirmed in the
 * Slice 4 reality audit) not to invent a geography/zone model.
 *
 * **A heatmap was investigated and deliberately not built.** Per the
 * founder's own instruction — "if a proper heat-map visualization is
 * feasible in operations-console, use it; otherwise start with an
 * accurate geographic aggregation rather than a visually impressive but
 * misleading approximation" — `google.maps.visualization.HeatmapLayer`
 * was checked directly against the installed `@types/google.maps`
 * package and confirmed genuinely unavailable: the Heatmap Layer
 * functionality was removed from the Maps JavaScript API as of v3.65 (an
 * ESLint `@typescript-eslint/no-deprecated` failure on the real call
 * caught this, not a guess). Building on a removed API would be exactly
 * the "visually impressive but misleading" trap the founder named — it
 * could look fine today and silently stop rendering. This grid-cell list
 * is the accurate aggregation instead: real coordinates, real pickup/
 * dropoff counts, sorted by activity. A map view remains a reasonable
 * future addition once a supported mapping approach (e.g. per-point
 * markers, or a maintained third-party heatmap library) is deliberately
 * chosen — not something to force through a deprecated call now.
 */
function GeographicDemandCellList({
  cells,
}: {
  cells: { latitude: number; longitude: number; pickupCount: number; dropoffCount: number }[];
}): React.JSX.Element {
  if (cells.length === 0) {
    return (
      <EmptyState title="No ride activity in this range" description="Try a wider time range." />
    );
  }
  return (
    <ul className="divide-border/70 max-h-[480px] divide-y overflow-y-auto">
      {cells.map((cell) => (
        <li
          key={`${String(cell.latitude)}:${String(cell.longitude)}`}
          className="flex items-center justify-between py-2 text-sm"
        >
          <span className="tabular-nums">
            {cell.latitude.toFixed(3)}, {cell.longitude.toFixed(3)}
          </span>
          <span className="text-muted-foreground flex gap-x-3 text-xs">
            <span>{formatCount(cell.pickupCount)} pickups</span>
            <span>{formatCount(cell.dropoffCount)} dropoffs</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function GeographicDemandAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useGeographicDemandAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Geographic Activity"
          description="Historical pickup/drop-off demand from real ride coordinates — no named zones."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading geographic demand…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load geographic demand"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Total pickups', value: formatCount(data.totalPickups) },
                { label: 'Total dropoffs', value: formatCount(data.totalDropoffs) },
                { label: 'Grid cells shown', value: formatCount(data.cells.length) },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>Demand by area</CardTitle>
              </CardHeader>
              <CardContent>
                <GeographicDemandCellList cells={data.cells} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
