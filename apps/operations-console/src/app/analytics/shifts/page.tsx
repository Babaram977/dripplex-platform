'use client';

import { EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AnalyticsDrilldownHeader } from '@/components/analytics-drilldown-header';
import { AnalyticsStatGrid } from '@/components/analytics-stat-grid';
import { AppShell } from '@/components/app-shell';
import { useShiftAnalytics } from '@/hooks/use-operations-analytics';
import { formatCount, formatDurationSeconds } from '@/lib/analytics-format';
import { DEFAULT_ANALYTICS_RANGE, type AnalyticsRangeValue } from '@/lib/analytics-range';

export default function ShiftAnalyticsPage(): React.JSX.Element {
  const [range, setRange] = React.useState<AnalyticsRangeValue>(DEFAULT_ANALYTICS_RANGE);
  const query = useShiftAnalytics(range);
  const data = query.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <AnalyticsDrilldownHeader
          title="Shift Analytics"
          description="Shift activity, break/fatigue reminders, and force-ended shifts — all from DriverShift."
          range={range}
          onRangeChange={setRange}
        />

        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading shift analytics…" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            title="Couldn't load shift analytics"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <>
            <AnalyticsStatGrid
              stats={[
                { label: 'Shifts started', value: formatCount(data.shiftsStarted) },
                { label: 'Shifts ended', value: formatCount(data.shiftsEnded) },
                { label: 'Active now', value: formatCount(data.activeShiftsNow) },
                { label: 'On break now', value: formatCount(data.onBreakShiftsNow) },
                { label: 'Force-ended', value: formatCount(data.forceEndedCount) },
              ]}
            />
            <AnalyticsStatGrid
              stats={[
                {
                  label: 'Average shift length',
                  value: formatDurationSeconds(data.averageShiftDurationSeconds),
                },
                {
                  label: 'Average break length',
                  value: formatDurationSeconds(data.averageBreakSeconds),
                },
                { label: 'Break reminders sent', value: formatCount(data.breakReminderCount) },
                { label: 'Fatigue warnings sent', value: formatCount(data.fatigueWarningCount) },
                {
                  label: 'Daily-limit notices sent',
                  value: formatCount(data.dailyLimitNotifiedCount),
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
