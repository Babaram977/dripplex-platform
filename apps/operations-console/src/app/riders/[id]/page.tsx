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

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  NATIONAL_ID: 'National ID',
  PASSPORT: 'Passport',
  DRIVER_LICENSE: "Driver's License",
  CAC_CERTIFICATE: 'CAC Certificate',
  BUSINESS_REGISTRATION: 'Business Registration',
  VEHICLE_REGISTRATION: 'Vehicle Registration',
  GUARANTOR_ID: 'Guarantor ID',
  INSURANCE: 'Insurance',
};

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
                <CardTitle>Company</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Company name</dt>
                  <dd>{riderQuery.data.companyName ?? '—'}</dd>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>KYC documents</CardTitle>
              </CardHeader>
              <CardContent>
                {riderQuery.data.kyc.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No documents submitted yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {riderQuery.data.kyc.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="text-sm">
                          <p className="font-medium">{DOCUMENT_TYPE_LABELS[doc.documentType]}</p>
                          <p className="text-muted-foreground">{doc.documentNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={doc.verificationStatus === 'VERIFIED' ? 'success' : 'outline'}
                          >
                            {doc.verificationStatus}
                          </Badge>
                          <a
                            href={doc.frontImage}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-sm underline"
                          >
                            View
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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
