'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DriverKycDto,
  DriverPerformanceStatsDto,
  DriverProfileDto,
  SubmitDriverKycRequest,
  UpdateDriverProfileRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const profileKeys = {
  all: ['driver-profile'] as const,
  performance: ['driver-profile', 'performance'] as const,
};

export function useDriverProfile(): UseQueryResult<DriverProfileDto> {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: () => sdk.profile.getOwnProfile(),
  });
}

export function useSubmitKyc(): UseMutationResult<DriverKycDto, Error, SubmitDriverKycRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitDriverKycRequest) => sdk.profile.submitKyc(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/** Driver Slice 2 item 9 — self-service edit of the founder-scoped
 * driver-editable profile fields. */
export function useUpdateDriverProfile(): UseMutationResult<
  DriverProfileDto,
  Error,
  UpdateDriverProfileRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDriverProfileRequest) => sdk.profile.updateOwnProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

/** Driver Slice 2 item 9 — read-only performance/ratings summary. */
export function useDriverPerformanceStats(): UseQueryResult<DriverPerformanceStatsDto> {
  return useQuery({
    queryKey: profileKeys.performance,
    queryFn: () => sdk.profile.getPerformanceStats(),
  });
}
