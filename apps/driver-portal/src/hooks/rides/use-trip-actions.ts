'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RateRideRequest, RideDto, RideRatingDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

function useRideMutation(
  mutationFn: (rideId: string) => Promise<RideDto>,
): UseMutationResult<RideDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.active(), ride.status === 'COMPLETED' ? null : ride);
    },
  });
}

export function useMarkArrived(): UseMutationResult<RideDto, Error, string> {
  return useRideMutation((rideId) => sdk.rides.markArrived(rideId));
}

export function useStartTrip(): UseMutationResult<RideDto, Error, string> {
  return useRideMutation((rideId) => sdk.rides.startTrip(rideId));
}

export function useCompleteTrip(): UseMutationResult<RideDto, Error, string> {
  return useRideMutation((rideId) => sdk.rides.completeTrip(rideId));
}

export interface CancelTripVariables {
  rideId: string;
  reason?: string;
}

export function useCancelTrip(): UseMutationResult<RideDto, Error, CancelTripVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reason }: CancelTripVariables) => sdk.rides.cancelTrip(rideId, reason),
    onSuccess: () => {
      queryClient.setQueryData(rideQueryKeys.active(), null);
    },
  });
}

export function useConfirmCash(): UseMutationResult<RideDto, Error, string> {
  return useMutation({
    mutationFn: (rideId: string) => sdk.rides.confirmCash(rideId),
  });
}

export interface RateCustomerVariables {
  rideId: string;
  body: RateRideRequest;
}

export function useRateCustomer(): UseMutationResult<RideRatingDto, Error, RateCustomerVariables> {
  return useMutation({
    mutationFn: ({ rideId, body }: RateCustomerVariables) => sdk.rides.rateCustomer(rideId, body),
  });
}
