'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import Link from 'next/link';
import * as React from 'react';

import type { QueueFilters } from '@/hooks/use-operations-queues';

import { AppShell } from '@/components/app-shell';
import { LifecycleStatusBadge } from '@/components/lifecycle-status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { QueueFilterBar } from '@/components/queue-filter-bar';
import { useSupportQueue } from '@/hooks/use-operations-queues';

/**
 * DPX-OPS-001 Slice 2 — Driver Support Queue. Per the founder's explicit
 * constraint, this is the only live support queue in Phase 1 — Customer
 * and Merchant support are architecture-only for now, see
 * docs/DPX-OPS-001-REALITY-AUDIT.md's "Founder review — approved" section.
 * No Ride/Vehicle filter here — `DriverSupportTicket` has neither column
 * (per the founder's 2026-08-05 decision not to modify the frozen table).
 */
export default function SupportQueuePage(): React.JSX.Element {
  const [filters, setFilters] = React.useState<QueueFilters>({});
  const queue = useSupportQueue(filters);
  const data = queue.data;
  const hasActiveFilter = Object.keys(filters).length > 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Driver Support Queue
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Driver support tickets awaiting a response.
          </p>
        </div>

        <QueueFilterBar value={filters} onChange={setFilters} />

        {queue.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading support queue…" />
          </div>
        ) : null}

        {queue.isError ? (
          <EmptyState
            title="Couldn't load the support queue"
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
          <EmptyState
            title="No support tickets"
            description={
              hasActiveFilter
                ? 'No tickets match the current filters.'
                : 'Nothing needs attention right now.'
            }
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border/70 divide-y">
                {data.items.map((item) => (
                  <Link
                    key={item.caseId}
                    href={`/queues/support/${item.caseId}`}
                    className="hover:bg-muted/40 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.driverName} · {item.subject}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Submitted {formatRelativeTime(item.createdAt)}
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
