'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useOperationsResponseAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount, formatDurationSeconds } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

const CASE_TYPE_LABEL: Record<string, string> = {
  SOS: 'SOS',
  INCIDENT: 'Incident',
  SUPPORT: 'Support',
};

/** DPX-OPS-001 Slice 4 — Operations Response drill-down: SOS, Incident,
 * and Support response/resolution/closure performance, uniformly, from
 * the one `OperationsCase` table Slice 2 built with SLA tracking as a
 * first-class concern. */
export default function OperationsResponseAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useOperationsResponseAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Operations Response"
          description="SOS, Incident, and Support response/resolution/closure performance."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading operations response…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load operations response"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Cases in range', value: formatCount(data.totalCases) },
                { label: 'Open right now', value: formatCount(data.openCasesCount) },
                {
                  label: 'Time to first response',
                  value: formatDurationSeconds(data.averageTimeToFirstResponseSeconds),
                },
                {
                  label: 'Time to resolution',
                  value: formatDurationSeconds(data.averageTimeToResolutionSeconds),
                },
                {
                  label: 'Time to closure',
                  value: formatDurationSeconds(data.averageTimeToClosureSeconds),
                },
              ]}
            />

            <Card>
              <CardHeader>
                <CardTitle>By queue</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-border/70 divide-y">
                  {data.byType.map((row) => (
                    <li key={row.caseType} className="flex flex-col gap-1 py-3 text-sm">
                      <span className="font-medium">
                        {CASE_TYPE_LABEL[row.caseType] ?? row.caseType} ·{' '}
                        {formatCount(row.totalCases)} cases
                      </span>
                      <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                        <span>
                          First response:{' '}
                          {formatDurationSeconds(row.averageTimeToFirstResponseSeconds)}
                        </span>
                        <span>
                          Resolution: {formatDurationSeconds(row.averageTimeToResolutionSeconds)}
                        </span>
                        <span>
                          Closure: {formatDurationSeconds(row.averageTimeToClosureSeconds)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
