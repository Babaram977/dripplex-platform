'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';

import type { ListSessionsResponse } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const sessionsQueryKey = ['auth', 'sessions'] as const;

/** Wallet Security's "Trusted devices" — real active `AuthSession` rows,
 * already built for the whole platform (device/browser/location parsing,
 * current-session flag, revoke). No new backend needed. */
export function useSessions(): UseQueryResult<ListSessionsResponse> {
  return useQuery({
    queryKey: sessionsQueryKey,
    queryFn: () => sdk.auth.listSessions(),
  });
}

export function useRevokeSession(): UseMutationResult<undefined, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => sdk.auth.revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
  });
}
