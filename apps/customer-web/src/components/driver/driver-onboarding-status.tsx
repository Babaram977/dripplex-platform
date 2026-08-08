'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, EmptyState } from '@dripplex/ui';
import Link from 'next/link';
import * as React from 'react';

import type { DriverActivationEligibilityDto, DriverOnboardingDto } from '@dripplex/types';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-driver' }
  | {
      kind: 'onboarding';
      data: DriverOnboardingDto;
      eligibility: DriverActivationEligibilityDto | null;
    }
  | { kind: 'error'; title: string; description: string };

const STATUS_COPY: Record<DriverOnboardingDto['status'], { label: string; detail: string }> = {
  DRAFT: {
    label: 'Getting started',
    detail: 'Register your vehicle and submit your documents to continue.',
  },
  SUBMITTED: {
    label: 'Waiting approval',
    detail: 'Your onboarding details are in for review.',
  },
  UNDER_REVIEW: {
    label: 'Waiting approval',
    detail: "DrippleX is reviewing your documents. We'll notify you once it's decided.",
  },
  APPROVED: {
    label: 'Approved',
    detail: "You're approved to drive.",
  },
  REJECTED: {
    label: 'Needs attention',
    detail: 'Your onboarding was not approved. Review your documents below.',
  },
};

const ONBOARDING_STEPS = [
  {
    href: '/driver-onboarding/vehicle',
    label: 'Vehicle registration',
    description: 'Make, model, year, colour, plate, ride category',
  },
  {
    href: '/driver-onboarding/documents',
    label: 'KYC documents',
    description: 'National ID, licence, vehicle paper, insurance',
  },
] as const;

/** Real activation-gate checks (`DriverActivationEligibilityDto.checks`,
 * `DriverActivationService`) -- the same all-or-nothing gate that decides
 * whether an admin's "approve" action can actually activate the driver.
 * Shown here so Waiting Approval isn't just static copy: it's the real
 * backend checklist, in the same order the DTO returns it. */
const CHECK_LABELS: Record<keyof DriverActivationEligibilityDto['checks'], string> = {
  identityVerified: 'Identity verified',
  requiredDocumentsApproved: 'Documents approved',
  vehicleApproved: 'Vehicle approved',
  inspectionPassed: 'Vehicle inspection passed',
  agreementAccepted: 'Driver agreement accepted',
  accountNotLocked: 'Account in good standing',
};

/**
 * Super App onboarding entry point (DPX-100 Priority 1), including Waiting
 * Approval -- founder decision 2026-08-08: no separate Figma screen exists
 * for this state, but the backend already fully models it
 * (`DriverActivationEligibilityDto`), so it's built here as Category A
 * rather than left undone. Reads the real onboarding record via the
 * already-live `GET /driver/onboarding` -- `DriverOnboardingClient`, the
 * same client driver-portal itself uses -- exposed here through
 * `CustomerSdk.driverOnboarding` (sdk.ts). A 403 here means the account
 * genuinely does not hold the `driver` role yet, which is the real
 * "Become a Driver" gate, not a decorative one: granting the role via
 * `sdk.auth.becomeDriver()` is what unlocks these endpoints.
 */
export function DriverOnboardingStatus(): React.JSX.Element {
  const { ready } = useRequireAuth();
  const { user, setUser } = useAuth();
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [submitting, setSubmitting] = React.useState(false);

  const loadOnboarding = React.useCallback(async (): Promise<void> => {
    setView({ kind: 'loading' });
    try {
      const data = await sdk.driverOnboarding.getOwn();
      // The activation-eligibility checklist is only meaningful once
      // something has been submitted -- skip it for DRAFT so a
      // brand-new driver doesn't see a wall of "not done yet" checks
      // before they've even started.
      const eligibility =
        data.status === 'DRAFT'
          ? null
          : await sdk.driverProfile.getActivationEligibility().catch(() => null);
      setView({ kind: 'onboarding', data, eligibility });
    } catch (error) {
      if (error instanceof DripplexApiError && error.statusCode === 403) {
        setView({ kind: 'not-driver' });
        return;
      }
      const described = describeSdkError(error);
      setView({ kind: 'error', title: described.title, description: described.description });
    }
  }, []);

  React.useEffect(() => {
    if (!ready) {
      return;
    }
    void loadOnboarding();
  }, [ready, loadOnboarding]);

  const onBecomeDriver = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await sdk.auth.becomeDriver();
      // The account's roles/permissions changed server-side; refresh the
      // local session so the Sidebar's role-toggle picks it up immediately
      // without a re-login (see PermissionsGuard -- it reads permissions
      // fresh per request, not from the JWT).
      const profile = await sdk.auth.me();
      setUser(profile);
      await loadOnboarding();
    } catch (error) {
      const described = describeSdkError(error);
      setView({ kind: 'error', title: described.title, description: described.description });
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || view.kind === 'loading') {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Loading…
      </div>
    );
  }

  if (view.kind === 'not-driver') {
    return (
      <EmptyState
        title="Become a Driver"
        description={`Add driving to your ${user?.firstName ?? 'DrippleX'} account -- same login, same wallet, no second account.`}
        action={
          <Button type="button" disabled={submitting} onClick={() => void onBecomeDriver()}>
            {submitting ? 'Setting up…' : 'Become a Driver'}
          </Button>
        }
      />
    );
  }

  if (view.kind === 'error') {
    return (
      <EmptyState
        title={view.title}
        description={view.description}
        action={
          <Button type="button" variant="outline" onClick={() => void loadOnboarding()}>
            Try again
          </Button>
        }
      />
    );
  }

  const copy = STATUS_COPY[view.data.status];
  const waiting = view.data.status === 'SUBMITTED' || view.data.status === 'UNDER_REVIEW';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Driver onboarding</h1>
        <p className="text-foreground text-sm font-medium">{copy.label}</p>
        <p className="text-muted-foreground text-sm">{copy.detail}</p>
      </div>

      {view.data.status === 'DRAFT' || view.data.status === 'REJECTED' ? (
        <div className="space-y-2.5">
          {ONBOARDING_STEPS.map((step) => (
            <Link
              key={step.href}
              href={step.href}
              className="border-border/70 bg-card/60 hover:bg-muted block rounded-2xl border p-4 transition-colors"
            >
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-muted-foreground text-xs">{step.description}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {waiting ? (
        <div className="space-y-3">
          {view.eligibility ? (
            <div className="space-y-2.5">
              {(Object.keys(CHECK_LABELS) as (keyof typeof CHECK_LABELS)[]).map((key) => {
                const passed = view.eligibility?.checks[key] ?? false;
                return (
                  <div
                    key={key}
                    className="border-border/70 bg-card/60 flex items-center justify-between rounded-2xl border p-3.5 text-sm"
                  >
                    <span className="font-medium">{CHECK_LABELS[key]}</span>
                    <span
                      className={
                        passed ? 'text-brand font-medium' : 'text-muted-foreground font-medium'
                      }
                    >
                      {passed ? 'Done' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadOnboarding()}
            className="w-full"
          >
            Refresh status
          </Button>
        </div>
      ) : null}
    </div>
  );
}
