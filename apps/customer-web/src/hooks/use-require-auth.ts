'use client';

import { useAuth } from '@dripplex/hooks';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { siteConfig } from '@/lib/site';

/** Redirect unauthenticated users to login once the auth store has hydrated. */
export function useRequireAuth(): {
  ready: boolean;
  isAuthenticated: boolean;
} {
  const { hydrated, isAuthenticated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(siteConfig.links.login);
    }
  }, [hydrated, isAuthenticated, router]);

  return {
    ready: hydrated && isAuthenticated,
    isAuthenticated,
  };
}
