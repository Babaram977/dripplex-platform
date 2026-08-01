'use client';

import { useMutation } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { RateRideRequest, RideRatingDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

interface RateDriverVariables {
  rideId: string;
  body: RateRideRequest;
}

export function useRateDriver(): UseMutationResult<RideRatingDto, Error, RateDriverVariables> {
  return useMutation({
    mutationFn: ({ rideId, body }: RateDriverVariables) => sdk.rides.rateDriver(rideId, body),
  });
}
