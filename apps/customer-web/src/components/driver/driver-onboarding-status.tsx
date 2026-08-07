'use client';

import { useAuth } from '@dripplex/hooks';
import { Button, EmptyState } from '@dripplex/ui';
import * as React from 'react';

import type { DriverOnboardingDto } from '@dripplex/types';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { describeSdkError, DripplexApiError, sdk } from '@/lib/sdk';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not-driver' }
  | { kind: 'onboarding'; data: DriverOnboardingDto }
  | { kind: 'error'; title: string; description: string };

const STATUS_COPY: Record<DriverOnboardingDto['status'], { label: string; detail: string }> = {
  DRAFT: {
    label: 'Getting started',
    detail: 'Your driver profile is set up. Continue in the Driver app to finish onboarding.',
  },
  SUBMITTED: {
    label: 'Submitted',
    detail: 'Your onboarding details are in for review.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    detail: "DrippleX is reviewing your documents. We'll notify you once it's decided.",
  },
  APPROVED: {
    label: 'Approved',
    detail: "You're approved to drive. Open the Driver app to go online.",
  },
  REJECTED: {
    label: 'Needs attention',
    detail: 'Your onboarding was not approved. Check the Driver app for details on what to fix.',
  },
};

/**
 * Super App onboarding entry point (DPX-100 Priority 1). Reads the real
 * onboarding record via the already-live `GET /driver/onboarding` --
 * `DriverOnboardingClient`, the same client driver-portal itself uses --
 * exposed here through `CustomerSdk.driverOnboarding` (sdk.ts). A 403 here
 * means the account genuinely does not hold the `driver` role yet, which
 * is the real "Become a Driver" gate, not a decorative one: granting the
 * role via `sdk.auth.becomeDriver()` is what unlocks these endpoints.
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
      setView({ kind: 'onboarding', data });
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

  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Driver onboarding</h1>
      <p className="text-foreground text-sm font-medium">{copy.label}</p>
      <p className="text-muted-foreground text-sm">{copy.detail}</p>
    </div>
  );
}
