'use client';

import { DripplexApiError } from '@dripplex/sdk';
import { Toaster } from '@dripplex/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { AuthProvider } from '../auth/use-auth';

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false;
  }
  if (error instanceof DripplexApiError) {
    if (error.statusCode === 429) {
      return true;
    }
    // Do not retry client auth / validation / not-found responses.
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
  }
  return true;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: (attempt, error) => {
          if (error instanceof DripplexApiError && error.retryAfterSeconds !== undefined) {
            return Math.min(error.retryAfterSeconds * 1000, 30_000);
          }
          return Math.min(1000 * 2 ** attempt, 8_000);
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = React.useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
