'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
  Select,
} from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { InspectionStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useInspections } from '@/hooks/use-inspections';

const STATUS_OPTIONS: { value: InspectionStatus | 'ALL'; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ALL', label: 'All inspections' },
];

function statusBadgeVariant(status: InspectionStatus): 'success' | 'outline' {
  return status === 'PASSED' ? 'success' : 'outline';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function InspectionsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<InspectionStatus | 'ALL'>('SCHEDULED');
  const query = useInspections(status === 'ALL' ? undefined : status);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Inspections</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Record vehicle inspection checklists and mark inspections passed or failed.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inspection-status-filter" className="text-muted-foreground text-xs">
              Filter
            </label>
            <Select
              id="inspection-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as InspectionStatus | 'ALL');
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inspection queue</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading ? <LoadingSpinner /> : null}
            {query.data?.items.length === 0 ? (
              <EmptyState
                title="No inspections in this queue"
                description="Nothing to review for the selected status."
              />
            ) : null}
            {query.data && query.data.items.length > 0 ? (
              <div className="border-border/70 divide-border/70 divide-y rounded-lg border">
                <div className="text-muted-foreground grid grid-cols-[1.5fr_1.5fr_1fr] gap-2 px-4 py-2 text-xs font-medium">
                  <span>Scheduled</span>
                  <span>Vehicle</span>
                  <span>Status</span>
                </div>
                {query.data.items.map((inspection) => (
                  <Link
                    key={inspection.id}
                    href={`/inspections/${inspection.id}`}
                    className="hover:bg-muted/40 grid grid-cols-[1.5fr_1.5fr_1fr] items-center gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{formatDate(inspection.scheduledAt)}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {inspection.vehicleId.slice(0, 8)}…
                    </span>
                    <span>
                      <Badge variant={statusBadgeVariant(inspection.status)}>
                        {inspection.status}
                      </Badge>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
