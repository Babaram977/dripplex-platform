'use client';

import { Badge, Button, Skeleton, toast } from '@dripplex/ui';
import * as React from 'react';

import type { DriverActivationChecks } from '@dripplex/types';

import {
  useActivationEligibility,
  useDriverOnboarding,
  useSubmitOnboarding,
} from '@/hooks/use-driver-onboarding';

const CHECK_LABELS: { key: keyof DriverActivationChecks; label: string }[] = [
  { key: 'identityVerified', label: 'Identity verified' },
  { key: 'requiredDocumentsApproved', label: 'Required documents approved' },
  { key: 'vehicleApproved', label: 'Vehicle approved' },
  { key: 'inspectionPassed', label: 'Vehicle inspection passed' },
  { key: 'agreementAccepted', label: 'Driver Agreement accepted' },
  { key: 'accountNotLocked', label: 'Account in good standing' },
];

/** Onboarding statuses that mean the driver has already submitted — the
 * "Submit for Review" action is no longer offered (mirrors the backend
 * OnboardingService.submitForReview guard). */
const SUBMITTED_STATUSES = new Set(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']);

export function SubmitRegistrationCard(): React.JSX.Element {
  const onboarding = useDriverOnboarding();
  const eligibility = useActivationEligibility();
  const submit = useSubmitOnboarding();

  const onSubmit = (): void => {
    submit.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Registration submitted for review' });
      },
      onError: (error) => {
        toast({
          title: "Couldn't submit registration",
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  if (onboarding.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const status = onboarding.data?.status ?? 'DRAFT';

  if (SUBMITTED_STATUSES.has(status)) {
    const label = status === 'APPROVED' ? 'Approved' : 'Waiting for approval';
    return (
      <div className="flex flex-col gap-2">
        <Badge variant={status === 'APPROVED' ? 'success' : 'outline'}>{label}</Badge>
        <p className="text-muted-foreground text-sm">
          Your registration has been submitted
          {status === 'UNDER_REVIEW' ? ' and is under review' : ''}. We&apos;ll notify you once a
          decision is made.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {eligibility.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : eligibility.data ? (
          <ul className="flex flex-col gap-1.5">
            {CHECK_LABELS.map(({ key, label }) => {
              const ok = eligibility.data.checks[key];
              return (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className={ok ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {ok ? '✓' : '○'}
                  </span>
                  <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        Submit your registration once you&apos;ve added your emergency contact, accepted the Driver
        Agreement, and uploaded at least one KYC document. Full activation also requires the checks
        above.
      </p>

      <Button type="button" disabled={submit.isPending} onClick={onSubmit}>
        Submit for Review
      </Button>
    </div>
  );
}
