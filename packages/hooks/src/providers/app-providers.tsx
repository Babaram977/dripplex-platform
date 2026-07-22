'use client';

import { Toaster } from '@dripplex/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { AuthProvider } from '../auth/use-auth';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
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
