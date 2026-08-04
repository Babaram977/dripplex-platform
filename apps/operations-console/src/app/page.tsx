'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { DriverList } from '@/components/driver-list';
import { FleetMap } from '@/components/fleet-map';
import { FleetSummaryTiles } from '@/components/fleet-summary-tiles';
import { OperationsMapsProvider } from '@/components/maps-provider';
import { useFleetSnapshot } from '@/hooks/use-fleet-snapshot';

/**
 * DPX-OPS-001 Slice 1 — the Live Fleet Map, the founder's required "first
 * screen operators see": "Think of it as the air traffic control screen
 * for DrippleX." Every element here answers "what is happening now?" or
 * "what needs attention now?" — the two questions the founder's Operations
 * Philosophy requires every screen to answer.
 */
export default function HomePage(): React.JSX.Element {
  const snapshot = useFleetSnapshot();

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

            <Card>
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
