'use client';

import { Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingSpinner } from '@dripplex/ui';
import { formatRelativeTime } from '@dripplex/utils';
import Link from 'next/link';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { LifecycleStatusBadge } from '@/components/lifecycle-status-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { useIncidentQueue } from '@/hooks/use-operations-queues';

const CATEGORY_LABEL: Record<string, string> = {
  ACCIDENT: 'Accident',
  PASSENGER_ALTERCATION: 'Passenger altercation',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown',
  SAFETY_CONCERN: 'Safety concern',
  OTHER: 'Other',
};

/**
 * DPX-OPS-001 Slice 2 — Incident Queue: accidents, vehicle issues, safety
 * reports. Founder's requirement — "Lost & found" and "Complaint
 * escalation" aren't modeled in the existing `IncidentReport` taxonomy
 * (`IncidentCategory` is ACCIDENT/PASSENGER_ALTERCATION/
 * VEHICLE_BREAKDOWN/SAFETY_CONCERN/OTHER) — that's a real, documented gap,
 * not silently dropped, see docs/DPX-OPS-001-REALITY-AUDIT.md.
 */
export default function IncidentQueuePage(): React.JSX.Element {
  const queue = useIncidentQueue();
  const data = queue.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Incident Queue</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Accidents, vehicle issues, and safety reports.
          </p>
        </div>

        {queue.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading incident queue…" />
          </div>
        ) : null}

        {queue.isError ? (
          <EmptyState
            title="Couldn't load the incident queue"
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
          <EmptyState title="No incidents" description="Nothing needs attention right now." />
        ) : null}

        {data && data.items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-border/70 divide-y">
                {data.items.map((item) => (
                  <Link
                    key={item.caseId}
                    href={`/queues/incidents/${item.caseId}`}
                    className="hover:bg-muted/40 flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.driverName} · {CATEGORY_LABEL[item.category] ?? item.category}
                      </p>
                      <p className="text-muted-foreground mt-0.5 max-w-xl truncate text-xs">
                        {item.description}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Reported {formatRelativeTime(item.createdAt)}
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
