'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DriverPlannedAvailabilityDto,
  SetDriverPlannedAvailabilityRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const plannedAvailabilityKeys = {
  all: ['driver-planned-availability'] as const,
};

export function usePlannedAvailability(): UseQueryResult<DriverPlannedAvailabilityDto[]> {
  return useQuery({
    queryKey: plannedAvailabilityKeys.all,
    queryFn: () => sdk.plannedAvailability.listOwn(),
  });
}

export function useCreatePlannedAvailability(): UseMutationResult<
  DriverPlannedAvailabilityDto,
  Error,
  SetDriverPlannedAvailabilityRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetDriverPlannedAvailabilityRequest) => sdk.plannedAvailability.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plannedAvailabilityKeys.all });
    },
  });
}

export function useDeletePlannedAvailability(): UseMutationResult<undefined, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.plannedAvailability.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plannedAvailabilityKeys.all });
    },
  });
}
