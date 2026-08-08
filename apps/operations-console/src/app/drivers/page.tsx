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

import type { DriverStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useDriverApplications } from '@/hooks/use-driver-approvals';

const STATUS_OPTIONS: { value: DriverStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending review' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'ALL', label: 'All drivers' },
];

function statusBadgeVariant(status: DriverStatus): 'success' | 'outline' {
  return status === 'APPROVED' ? 'success' : 'outline';
}

export default function DriverApprovalsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<DriverStatus | 'ALL'>('PENDING');
  const query = useDriverApplications(status === 'ALL' ? undefined : status);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Driver Approvals</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review driver applications, verify KYC documents, and approve or reject drivers.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="driver-status-filter" className="text-muted-foreground text-xs">
              Filter
            </label>
            <Select
              id="driver-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as DriverStatus | 'ALL');
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
                title="No drivers in this queue"
                description="Nothing to review for the selected status."
              />
            ) : null}
            {query.data && query.data.items.length > 0 ? (
              <div className="border-border/70 divide-border/70 divide-y rounded-lg border">
                <div className="text-muted-foreground grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-4 py-2 text-xs font-medium">
                  <span>Driver</span>
                  <span>Phone</span>
                  <span>Status</span>
                  <span>KYC</span>
                </div>
                {query.data.items.map((driver) => {
                  const pending = driver.kyc.filter(
                    (k) => k.verificationStatus === 'PENDING',
                  ).length;
                  return (
                    <Link
                      key={driver.driverId}
                      href={`/drivers/${driver.driverId}`}
                      className="hover:bg-muted/40 grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">
                        {driver.firstName} {driver.lastName}
                      </span>
                      <span className="text-muted-foreground">{driver.phone ?? '—'}</span>
                      <span>
                        <Badge variant={statusBadgeVariant(driver.status)}>{driver.status}</Badge>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {driver.kyc.length} docs
                        {pending > 0 ? ` · ${String(pending)} pending` : ''}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
