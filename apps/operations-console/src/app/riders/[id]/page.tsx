'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
} from '@dripplex/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';

import { AppShell } from '@/components/app-shell';
import { RiderLifecycleActions } from '@/components/rider-lifecycle-actions';
import { useRiderReview } from '@/hooks/use-rider-approvals';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function RiderReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const riderId = params.id;
  const riderQuery = useRiderReview(riderId);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {riderQuery.isLoading ? <LoadingSpinner /> : null}
        {riderQuery.isError ? (
          <EmptyState title="Rider not found" description="This rider could not be loaded." />
        ) : null}

        {riderQuery.data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {riderQuery.data.firstName} {riderQuery.data.lastName}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {riderQuery.data.email} · {riderQuery.data.phone ?? 'no phone'}
                </p>
              </div>
              <Badge variant={riderQuery.data.status === 'APPROVED' ? 'success' : 'outline'}>
                {riderQuery.data.status}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Application</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{riderQuery.data.status}</dd>
                  <dt className="text-muted-foreground">Applied</dt>
                  <dd>{formatDate(riderQuery.data.createdAt)}</dd>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd>{formatDate(riderQuery.data.approvedAt)}</dd>
                  <dt className="text-muted-foreground">Suspended</dt>
                  <dd>{formatDate(riderQuery.data.suspendedAt)}</dd>
                  {riderQuery.data.rejectedReason ? (
                    <>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd>{riderQuery.data.rejectedReason}</dd>
                    </>
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rider decision</CardTitle>
              </CardHeader>
              <CardContent>
                <RiderLifecycleActions rider={riderQuery.data} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
