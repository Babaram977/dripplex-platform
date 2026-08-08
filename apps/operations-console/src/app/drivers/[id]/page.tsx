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

import type { DriverActivationChecks } from '@dripplex/types';

import { AppShell } from '@/components/app-shell';
import { DriverKycReview } from '@/components/driver-kyc-review';
import { DriverLifecycleActions } from '@/components/driver-lifecycle-actions';
import { useDriverEligibility, useDriverReview } from '@/hooks/use-driver-approvals';

const CHECK_LABELS: { key: keyof DriverActivationChecks; label: string }[] = [
  { key: 'identityVerified', label: 'Identity verified' },
  { key: 'requiredDocumentsApproved', label: 'Required documents approved' },
  { key: 'vehicleApproved', label: 'Vehicle approved' },
  { key: 'inspectionPassed', label: 'Vehicle inspection passed' },
  { key: 'agreementAccepted', label: 'Driver Agreement accepted' },
  { key: 'accountNotLocked', label: 'Account in good standing' },
];

export default function DriverReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const driverId = params.id;
  const driverQuery = useDriverReview(driverId);
  const eligibilityQuery = useDriverEligibility(driverId);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {driverQuery.isLoading ? <LoadingSpinner /> : null}
        {driverQuery.isError ? (
          <EmptyState title="Driver not found" description="This driver could not be loaded." />
        ) : null}

        {driverQuery.data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {driverQuery.data.firstName} {driverQuery.data.lastName}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  {driverQuery.data.email} · {driverQuery.data.phone ?? 'no phone'}
                </p>
              </div>
              <Badge variant={driverQuery.data.status === 'APPROVED' ? 'success' : 'outline'}>
                {driverQuery.data.status}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Activation checklist</CardTitle>
              </CardHeader>
              <CardContent>
                {eligibilityQuery.isLoading ? <LoadingSpinner /> : null}
                {eligibilityQuery.data ? (
                  <ul className="flex flex-col gap-1.5">
                    {CHECK_LABELS.map(({ key, label }) => {
                      const ok = eligibilityQuery.data.checks[key];
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          <span
                            aria-hidden
                            className={ok ? 'text-emerald-600' : 'text-muted-foreground'}
                          >
                            {ok ? '✓' : '○'}
                          </span>
                          <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {eligibilityQuery.data && !eligibilityQuery.data.eligible ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Blocking: {eligibilityQuery.data.missingReasons.join(', ')}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>KYC documents</CardTitle>
              </CardHeader>
              <CardContent>
                <DriverKycReview driverId={driverId} documents={driverQuery.data.kyc} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Driver decision</CardTitle>
              </CardHeader>
              <CardContent>
                <DriverLifecycleActions driver={driverQuery.data} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
