'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { DriverAvailabilityDto, RideType } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useDriverAvailability(): UseQueryResult<DriverAvailabilityDto | null> {
  return useQuery({
    queryKey: rideQueryKeys.availability(),
    queryFn: () => sdk.rides.getAvailability(),
    refetchInterval: 30_000,
  });
}

export interface SetAvailabilityInput {
  online: boolean;
  acceptingRides: boolean;
  vehicleType: RideType;
  latitude?: number;
  longitude?: number;
}

export function useSetDriverAvailability(): UseMutationResult<
  DriverAvailabilityDto,
  Error,
  SetAvailabilityInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetAvailabilityInput) => sdk.rides.updateAvailability(body),
    onSuccess: (data) => {
      queryClient.setQueryData(rideQueryKeys.availability(), data);
    },
  });
}
