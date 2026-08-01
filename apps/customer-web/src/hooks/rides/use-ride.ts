'use client';

import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type { ListRidesQuery } from '@dripplex/sdk';
import type { PaginatedResult, RequestRideRequest, RideDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useRideList(query: ListRidesQuery = {}): UseQueryResult<PaginatedResult<RideDto>> {
  return useQuery({
    queryKey: rideQueryKeys.list(query),
    queryFn: () => sdk.rides.listRides(query),
  });
}

export function useRide(rideId: string | undefined): UseQueryResult<RideDto> {
  return useQuery({
    queryKey: rideQueryKeys.detail(rideId ?? ''),
    queryFn: rideId !== undefined ? () => sdk.rides.getRide(rideId) : skipToken,
  });
}

export function useRequestRide(): UseMutationResult<RideDto, Error, RequestRideRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestRideRequest) => sdk.rides.requestRide(body),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.detail(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.lists() });
    },
  });
}

interface CancelRideVariables {
  rideId: string;
  reason?: string;
}

export function useCancelRide(): UseMutationResult<RideDto, Error, CancelRideVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: CancelRideVariables) => sdk.rides.cancelRide(rideId, reason),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.detail(ride.id), ride);
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.lists() });
    },
  });
}
