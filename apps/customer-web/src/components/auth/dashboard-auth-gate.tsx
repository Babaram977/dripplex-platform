'use client';

import * as React from 'react';

import { useRequireAuth } from '@/hooks/use-require-auth';

/** Client auth gate for the customer dashboard shell (Program C3). */
export function DashboardAuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { ready, isAuthenticated } = useRequireAuth();

  if (!ready) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        {isAuthenticated ? 'Loading…' : 'Checking session…'}
      </div>
    );
  }

  return <>{children}</>;
}
