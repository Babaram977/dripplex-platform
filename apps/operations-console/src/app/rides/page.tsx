'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { RideQueueList } from '@/components/ride-queue-list';
import { useRideQueue } from '@/hooks/use-ride-queue';

function SummaryTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * DPX-OPS-001 Slice 1 — Ride Queue screen. Answers "what needs assignment
 * or is in flight right now?" — the second question the founder's
 * Operations Philosophy requires every screen to answer.
 */
export default function RidesPage(): React.JSX.Element {
  const queue = useRideQueue();

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Ride Queue</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Requested, assigned, and in-progress rides across the platform.
          </p>
        </div>

        {queue.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading ride queue…" />
          </div>
        ) : null}

        {queue.isError ? (
          <EmptyState
            title="Couldn't load the ride queue"
            description="Check your connection and try again."
          />
        ) : null}

        {queue.data ? (
          <>
            <div className="grid grid-cols-3 gap-4 sm:max-w-md">
              <SummaryTile label="Pending" value={queue.data.summary.pendingCount} />
              <SummaryTile label="Assigned" value={queue.data.summary.assignedCount} />
              <SummaryTile label="In progress" value={queue.data.summary.inProgressCount} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Live rides</CardTitle>
              </CardHeader>
              <CardContent>
                <RideQueueList rides={queue.data.rides} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
