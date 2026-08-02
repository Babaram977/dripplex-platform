'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DriverKycDto, DriverProfileDto, SubmitDriverKycRequest } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const profileKeys = {
  all: ['driver-profile'] as const,
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
