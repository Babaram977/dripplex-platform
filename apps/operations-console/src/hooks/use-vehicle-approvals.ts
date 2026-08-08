'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PaginatedResult, VehicleApprovalStatus, VehicleDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const vehicleKeys = {
  listPrefix: ['admin-vehicles'] as const,
  list: (status: VehicleApprovalStatus | 'ALL') => ['admin-vehicles', status] as const,
};

/** DPX-DRIVER-011 — vehicle-approval queue for the Ops Console. Defaults to the
 * full list; pass a status to scope (e.g. PENDING awaiting review). */
export function useVehicleApprovals(
  status?: VehicleApprovalStatus,
): UseQueryResult<PaginatedResult<VehicleDto>> {
  return useQuery({
    queryKey: vehicleKeys.list(status ?? 'ALL'),
    queryFn: () =>
      sdk.adminDriverVehicles.list(status !== undefined ? { approvalStatus: status } : {}),
    refetchInterval: 15_000,
  });
}

function useVehicleMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<VehicleDto>,
): UseMutationResult<VehicleDto, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.listPrefix });
    },
  });
}

export function useApproveVehicle(): UseMutationResult<VehicleDto, Error, string> {
  return useVehicleMutation((id: string) => sdk.adminDriverVehicles.approve(id));
}

export function useRejectVehicle(): UseMutationResult<
  VehicleDto,
  Error,
  { id: string; reason: string }
> {
  return useVehicleMutation(({ id, reason }: { id: string; reason: string }) =>
    sdk.adminDriverVehicles.reject(id, reason),
  );
}
