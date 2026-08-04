'use client';

import { useAuth } from '@dripplex/hooks';
import * as React from 'react';

import { useRequireAuth } from '@/hooks/use-require-auth';
import { sdk } from '@/lib/sdk';

/**
 * Client auth gate for the customer dashboard shell (Program C3).
 *
 * The auth store deliberately never persists `user` to localStorage (PII —
 * see auth-store.ts's C3 comment), so on any fresh full-page load (a
 * reload, or a direct navigation to a route like /wallet or /ride) the
 * store rehydrates `accessToken` but `user` comes back null — the store's
 * own comment says identity should be "rehydrated via /auth/me after
 * login/probe", but nothing actually called it anywhere in the app. Real
 * screens reading `user.firstName` (Ride Home, Wallet Home) silently fell
 * back to a generic greeting instead of the customer's real name. Fixed
 * here, at the one real gate every dashboard-shell route already passes
 * through, rather than duplicating the fetch in each screen.
 */
export function DashboardAuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { ready, isAuthenticated } = useRequireAuth();
  const { user, setUser } = useAuth();
  const [profileChecked, setProfileChecked] = React.useState(false);

  React.useEffect(() => {
    if (!ready || user) {
      return;
    }
    let cancelled = false;
    void sdk.auth
      .me()
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user, setUser]);

  if (!ready || (!user && !profileChecked)) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        {isAuthenticated ? 'Loading…' : 'Checking session…'}
      </div>
    );
  }

  return <>{children}</>;
}
