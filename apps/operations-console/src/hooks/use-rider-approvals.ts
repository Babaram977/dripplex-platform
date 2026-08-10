'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RiderApprovalDto, RiderProfileDto, RiderStatus } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Structural mirror of the SDK's PaginatedRidersResult. */
export interface RiderListResult {
  items: RiderProfileDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const riderKeys = {
  listPrefix: ['admin-riders'] as const,
  list: (status: RiderStatus | 'ALL') => ['admin-riders', status] as const,
  detail: (id: string) => ['admin-rider', id] as const,
};

/** DPX-RIDER-001 — rider applications/roster for the Ops Console review
 * screen. Defaults to the full list; pass a status to scope to a queue. */
export function useRiderApplications(status?: RiderStatus): UseQueryResult<RiderListResult> {
  return useQuery({
    queryKey: riderKeys.list(status ?? 'ALL'),
    queryFn: () => sdk.adminRiders.listRiders(status !== undefined ? { status } : {}),
    refetchInterval: 15_000,
  });
}

export function useRiderReview(riderId: string): UseQueryResult<RiderProfileDto> {
  return useQuery({
    queryKey: riderKeys.detail(riderId),
    queryFn: () => sdk.adminRiders.getRider(riderId),
  });
}

function useRiderMutation<TArgs, TResult>(
  riderId: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riderKeys.detail(riderId) });
      void queryClient.invalidateQueries({ queryKey: riderKeys.listPrefix });
    },
  });
}

export function useApproveRider(riderId: string): UseMutationResult<RiderApprovalDto, Error, void> {
  return useRiderMutation(riderId, () => sdk.adminRiders.approveRider(riderId));
}

export function useRejectRider(
  riderId: string,
): UseMutationResult<RiderApprovalDto, Error, string> {
  return useRiderMutation(riderId, (reason: string) =>
    sdk.adminRiders.rejectRider(riderId, reason),
  );
}

export function useSuspendRider(
  riderId: string,
): UseMutationResult<RiderApprovalDto, Error, string> {
  return useRiderMutation(riderId, (reason: string) =>
    sdk.adminRiders.suspendRider(riderId, reason),
  );
}

export function useReactivateRider(
  riderId: string,
): UseMutationResult<RiderApprovalDto, Error, void> {
  return useRiderMutation(riderId, () => sdk.adminRiders.reactivateRider(riderId));
}
