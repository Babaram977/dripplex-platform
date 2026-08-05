'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { ActivityFeedPanel } from '@/components/activity-feed-panel';
import { AppShell } from '@/components/app-shell';
import { DriverList } from '@/components/driver-list';
import { FleetMap } from '@/components/fleet-map';
import { FleetSummaryTiles } from '@/components/fleet-summary-tiles';
import { OperationsMapsProvider } from '@/components/maps-provider';
import { QueueCountersTiles } from '@/components/queue-counters-tiles';
import { useFleetSnapshot } from '@/hooks/use-fleet-snapshot';
import { useActivityFeed, useDashboardCounters } from '@/hooks/use-operations-dashboard';

/**
 * DPX-OPS-001 Slice 1/2 — the Live Fleet Map, the founder's required
 * "first screen operators see": "Think of it as the air traffic control
 * screen for DrippleX." Every element here answers "what is happening
 * now?" or "what needs attention now?" — the two questions the founder's
 * Operations Philosophy requires every screen to answer. The queue
 * counters and Live Activity Feed are Slice 2's dashboard extension.
 */
export default function HomePage(): React.JSX.Element {
  const snapshot = useFleetSnapshot();
  const counters = useDashboardCounters();
  const activityFeed = useActivityFeed();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Live Fleet Map</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Real-time driver locations and status across the fleet.
          </p>
        </div>

        {snapshot.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading fleet snapshot…" />
          </div>
        ) : null}

        {snapshot.isError ? (
          <EmptyState
            title="Couldn't load the fleet snapshot"
            description="Check your connection and try again."
          />
        ) : null}

        {snapshot.data ? (
          <>
            <FleetSummaryTiles summary={snapshot.data.summary} />

            {counters.data ? <QueueCountersTiles counters={counters.data} /> : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Fleet map</CardTitle>
                </CardHeader>
                <CardContent>
                  <OperationsMapsProvider>
                    <FleetMap drivers={snapshot.data.drivers} />
                  </OperationsMapsProvider>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Live activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {activityFeed.isLoading ? (
                    <LoadingSpinner label="Loading activity…" />
                  ) : activityFeed.data ? (
                    <ActivityFeedPanel items={activityFeed.data.items} />
                  ) : (
                    <EmptyState
                      title="Couldn't load activity"
                      description="Check your connection and try again."
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Drivers</CardTitle>
              </CardHeader>
              <CardContent>
                <DriverList drivers={snapshot.data.drivers} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
