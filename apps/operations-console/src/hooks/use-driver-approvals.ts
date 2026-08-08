'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DriverActivationEligibilityDto,
  DriverApprovalDto,
  DriverKycDto,
  DriverProfileDto,
  DriverStatus,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Structural mirror of the SDK's PaginatedDriversResult (not re-exported
 * from the barrels). */
export interface DriverListResult {
  items: DriverProfileDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const driverKeys = {
  listPrefix: ['admin-drivers'] as const,
  list: (status: DriverStatus | 'ALL') => ['admin-drivers', status] as const,
  detail: (id: string) => ['admin-driver', id] as const,
  eligibility: (id: string) => ['admin-driver-eligibility', id] as const,
};

/** DPX-DRIVER-008 — driver applications/roster for the Ops Console review
 * screen. Defaults to the full list; pass a status to scope to a queue
 * (e.g. PENDING applications awaiting review). */
export function useDriverApplications(status?: DriverStatus): UseQueryResult<DriverListResult> {
  return useQuery({
    queryKey: driverKeys.list(status ?? 'ALL'),
    queryFn: () => sdk.adminDrivers.listDrivers(status !== undefined ? { status } : {}),
    refetchInterval: 15_000,
  });
}

export function useDriverReview(driverId: string): UseQueryResult<DriverProfileDto> {
  return useQuery({
    queryKey: driverKeys.detail(driverId),
    queryFn: () => sdk.adminDrivers.getDriver(driverId),
  });
}

export function useDriverEligibility(
  driverId: string,
): UseQueryResult<DriverActivationEligibilityDto> {
  return useQuery({
    queryKey: driverKeys.eligibility(driverId),
    queryFn: () => sdk.adminDrivers.getActivationEligibility(driverId),
  });
}

function useDriverMutation<TArgs, TResult>(
  driverId: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: driverKeys.detail(driverId) });
      void queryClient.invalidateQueries({ queryKey: driverKeys.eligibility(driverId) });
      void queryClient.invalidateQueries({ queryKey: driverKeys.listPrefix });
    },
  });
}

export function useApproveDriver(
  driverId: string,
): UseMutationResult<DriverApprovalDto, Error, void> {
  return useDriverMutation(driverId, () => sdk.adminDrivers.approveDriver(driverId));
}

export function useRejectDriver(
  driverId: string,
): UseMutationResult<DriverApprovalDto, Error, string> {
  return useDriverMutation(driverId, (reason: string) =>
    sdk.adminDrivers.rejectDriver(driverId, reason),
  );
}

export function useSuspendDriver(
  driverId: string,
): UseMutationResult<DriverApprovalDto, Error, string> {
  return useDriverMutation(driverId, (reason: string) =>
    sdk.adminDrivers.suspendDriver(driverId, reason),
  );
}

export function useReactivateDriver(
  driverId: string,
): UseMutationResult<DriverApprovalDto, Error, void> {
  return useDriverMutation(driverId, () => sdk.adminDrivers.reactivateDriver(driverId));
}

export function useVerifyKyc(
  driverId: string,
): UseMutationResult<DriverKycDto, Error, { kycId: string; remarks?: string }> {
  return useDriverMutation(driverId, ({ kycId, remarks }: { kycId: string; remarks?: string }) =>
    sdk.adminDrivers.verifyKyc(kycId, remarks),
  );
}

export function useRejectKyc(
  driverId: string,
): UseMutationResult<DriverKycDto, Error, { kycId: string; remarks: string }> {
  return useDriverMutation(driverId, ({ kycId, remarks }: { kycId: string; remarks: string }) =>
    sdk.adminDrivers.rejectKyc(kycId, remarks),
  );
}
