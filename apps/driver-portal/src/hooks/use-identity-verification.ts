'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DriverIdentityVerificationDto,
  IdentityVerificationStatusDto,
  SubmitIdentityVerificationRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const identityVerificationKeys = {
  all: ['driver-identity-verification'] as const,
  status: (deviceId: string | undefined) =>
    [...identityVerificationKeys.all, 'status', deviceId ?? null] as const,
};

export function useIdentityVerificationStatus(
  deviceId: string | undefined,
): UseQueryResult<IdentityVerificationStatusDto> {
  return useQuery({
    queryKey: identityVerificationKeys.status(deviceId),
    queryFn: () => sdk.identityVerification.getStatus(deviceId),
  });
}

export function useSubmitIdentityVerification(): UseMutationResult<
  DriverIdentityVerificationDto,
  Error,
  SubmitIdentityVerificationRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitIdentityVerificationRequest) => sdk.identityVerification.submit(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: identityVerificationKeys.all });
    },
  });
}
