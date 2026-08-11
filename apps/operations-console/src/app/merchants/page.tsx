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

import type { MerchantStatus } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { useMerchantApplications } from '@/hooks/use-merchant-approvals';

const STATUS_OPTIONS: { value: MerchantStatus | 'ALL'; label: string }[] = [
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'ALL', label: 'All merchants' },
];

function statusBadgeVariant(status: MerchantStatus): 'success' | 'outline' {
  return status === 'APPROVED' ? 'success' : 'outline';
}

export default function MerchantApprovalsPage(): React.JSX.Element {
  const [status, setStatus] = React.useState<MerchantStatus | 'ALL'>('UNDER_REVIEW');
  const query = useMerchantApplications(status === 'ALL' ? undefined : status);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Merchant Approvals
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review merchant onboarding applications and approve, reject, suspend or reactivate
              merchants.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="merchant-status-filter" className="text-muted-foreground text-xs">
              Filter
            </label>
            <Select
              id="merchant-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as MerchantStatus | 'ALL');
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
                title="No merchants in this queue"
                description="Nothing to review for the selected status."
              />
            ) : null}
            {query.data && query.data.items.length > 0 ? (
              <div className="border-border/70 divide-border/70 divide-y rounded-lg border">
                <div className="text-muted-foreground grid grid-cols-[2fr_1.5fr_1fr] gap-2 px-4 py-2 text-xs font-medium">
                  <span>Business</span>
                  <span>Location</span>
                  <span>Status</span>
                </div>
                {query.data.items.map((merchant) => (
                  <Link
                    key={merchant.merchantId}
                    href={`/merchants/${merchant.merchantId}`}
                    className="hover:bg-muted/40 grid grid-cols-[2fr_1.5fr_1fr] items-center gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {merchant.business?.businessName ??
                        `${merchant.firstName} ${merchant.lastName}`}
                    </span>
                    <span className="text-muted-foreground">
                      {merchant.business
                        ? [merchant.business.city, merchant.business.state]
                            .filter(Boolean)
                            .join(', ') || '—'
                        : '—'}
                    </span>
                    <span>
                      <Badge variant={statusBadgeVariant(merchant.status)}>{merchant.status}</Badge>
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
