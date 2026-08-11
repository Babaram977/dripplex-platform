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
import { MerchantLifecycleActions } from '@/components/merchant-lifecycle-actions';
import { useMerchantReview } from '@/hooks/use-merchant-approvals';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function MerchantReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const merchantId = params.id;
  const merchantQuery = useMerchantReview(merchantId);
  const profile = merchantQuery.data?.profile;
  const business = profile?.business ?? null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {merchantQuery.isLoading ? <LoadingSpinner /> : null}
        {merchantQuery.isError ? (
          <EmptyState title="Merchant not found" description="This merchant could not be loaded." />
        ) : null}

        {profile ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {business?.businessName ?? `${profile.firstName} ${profile.lastName}`}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {profile.email} · {profile.phone ?? 'no phone'}
                </p>
              </div>
              <Badge variant={profile.status === 'APPROVED' ? 'success' : 'outline'}>
                {profile.status}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Application</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{profile.status}</dd>
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>
                    {profile.firstName} {profile.lastName}
                  </dd>
                  <dt className="text-muted-foreground">Applied</dt>
                  <dd>{formatDate(profile.createdAt)}</dd>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd>{formatDate(profile.approvedAt)}</dd>
                  <dt className="text-muted-foreground">Suspended</dt>
                  <dd>{formatDate(profile.suspendedAt)}</dd>
                  {profile.rejectedReason ? (
                    <>
                      <dt className="text-muted-foreground">Reason</dt>
                      <dd>{profile.rejectedReason}</dd>
                    </>
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business</CardTitle>
              </CardHeader>
              <CardContent>
                {business ? (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Business name</dt>
                    <dd>{business.businessName}</dd>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{business.businessType}</dd>
                    <dt className="text-muted-foreground">Registration no.</dt>
                    <dd>{business.registrationNumber}</dd>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd>
                      {[business.city, business.state, business.country]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                    <dt className="text-muted-foreground">Business status</dt>
                    <dd>{business.status}</dd>
                    <dt className="text-muted-foreground">Verification</dt>
                    <dd>{business.verificationStatus}</dd>
                    {business.description ? (
                      <>
                        <dt className="text-muted-foreground">Description</dt>
                        <dd>{business.description}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No business profile submitted yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Merchant decision</CardTitle>
              </CardHeader>
              <CardContent>
                <MerchantLifecycleActions merchant={profile} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
