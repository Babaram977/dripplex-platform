'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import Link from 'next/link';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { LifecycleStatusBadge } from '@/components/lifecycle-status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { useSosQueue } from '@/hooks/use-operations-queues';

/**
 * DPX-OPS-001 Slice 2 — SOS Queue. Answers "who needs help right now?" —
 * the founder's first Slice 2 question. Sorted by the backend's own
 * priority-then-recency ordering (SOS cases always default CRITICAL).
 */
export default function SosQueuePage(): React.JSX.Element {
  const queue = useSosQueue();
  const data = queue.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">SOS Queue</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Active SOS alerts, highest priority first.
          </p>
        </div>

        {queue.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading SOS queue…" />
          </div>
        ) : null}

        {queue.isError ? (
          <EmptyState
            title="Couldn't load the SOS queue"
            description="Check your connection and try again."
          />
        ) : null}

        {data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
            <SummaryTile label="New" value={data.summary.newCount} />
            <SummaryTile label="Assigned" value={data.summary.assignedCount} />
            <SummaryTile label="In progress" value={data.summary.inProgressCount} />
            <SummaryTile label="Waiting" value={data.summary.waitingCount} />
            <SummaryTile label="Resolved" value={data.summary.resolvedCount} />
            <SummaryTile label="Closed" value={data.summary.closedCount} />
          </div>
        ) : null}

        {data?.items.length === 0 ? (
          <EmptyState title="No SOS alerts" description="Nothing needs attention right now." />
        ) : null}

        {data && data.items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Active alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border/70 divide-y">
                {data.items.map((item) => (
                  <Link
                    key={item.caseId}
                    href={`/queues/sos/${item.caseId}`}
                    className="hover:bg-muted/40 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.driverName}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.latitude !== null && item.longitude !== null
                          ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
                          : 'No location on file'}
                        {' · '}
                        Triggered {formatRelativeTime(item.createdAt)}
                        {item.assignedToName ? ` · Assigned to ${item.assignedToName}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <PriorityBadge priority={item.priority} />
                      <LifecycleStatusBadge status={item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
