'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { Toaster } from '@/components/ui/toast';

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
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
