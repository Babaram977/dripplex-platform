'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type {
  InitiateRidePaymentRequest,
  InitiateRidePaymentResponse,
  RideDto,
} from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

interface InitiateRidePaymentVariables {
  rideId: string;
  body: InitiateRidePaymentRequest;
}

export function useInitiateRidePayment(): UseMutationResult<
  InitiateRidePaymentResponse,
  Error,
  InitiateRidePaymentVariables
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, body }: InitiateRidePaymentVariables) =>
      sdk.rides.initiatePayment(rideId, body),
    onSuccess: (result, { rideId }) => {
      queryClient.setQueryData(rideQueryKeys.detail(rideId), result.ride);
    },
  });
}

interface VerifyRidePaymentVariables {
  rideId: string;
  reference?: string;
}

export function useVerifyRidePayment(): UseMutationResult<
  RideDto,
  Error,
  VerifyRidePaymentVariables
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, reference }: VerifyRidePaymentVariables) =>
      sdk.rides.verifyPayment(rideId, reference),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.detail(ride.id), ride);
    },
  });
}

interface TipDriverVariables {
  rideId: string;
  amount: number;
}

export function useTipDriver(): UseMutationResult<RideDto, Error, TipDriverVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, amount }: TipDriverVariables) => sdk.rides.tipDriver(rideId, { amount }),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.detail(ride.id), ride);
    },
  });
}
