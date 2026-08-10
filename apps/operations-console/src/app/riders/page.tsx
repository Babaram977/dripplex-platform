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

import type { RiderStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useRiderApplications } from '@/hooks/use-rider-approvals';

const STATUS_OPTIONS: { value: RiderStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending review' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'ALL', label: 'All riders' },
];

function statusBadgeVariant(status: RiderStatus): 'success' | 'outline' {
  return status === 'APPROVED' ? 'success' : 'outline';
}

export default function RiderApprovalsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<RiderStatus | 'ALL'>('PENDING');
  const query = useRiderApplications(status === 'ALL' ? undefined : status);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Rider Approvals</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review delivery-rider applications and approve, reject, suspend or reactivate riders.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rider-status-filter" className="text-muted-foreground text-xs">
              Filter
            </label>
            <Select
              id="rider-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as RiderStatus | 'ALL');
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
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading ? <LoadingSpinner /> : null}
            {query.data?.items.length === 0 ? (
              <EmptyState
                title="No riders in this queue"
                description="Nothing to review for the selected status."
              />
            ) : null}
            {query.data && query.data.items.length > 0 ? (
              <div className="border-border/70 divide-border/70 divide-y rounded-lg border">
                <div className="text-muted-foreground grid grid-cols-[2fr_1fr_1fr] gap-2 px-4 py-2 text-xs font-medium">
                  <span>Rider</span>
                  <span>Phone</span>
                  <span>Status</span>
                </div>
                {query.data.items.map((rider) => (
                  <Link
                    key={rider.riderId}
                    href={`/riders/${rider.riderId}`}
                    className="hover:bg-muted/40 grid grid-cols-[2fr_1fr_1fr] items-center gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {rider.firstName} {rider.lastName}
                    </span>
                    <span className="text-muted-foreground">{rider.phone ?? '—'}</span>
                    <span>
                      <Badge variant={statusBadgeVariant(rider.status)}>{rider.status}</Badge>
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
