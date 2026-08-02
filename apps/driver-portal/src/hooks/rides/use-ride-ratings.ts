'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideRatingDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useRideRatings(rideId: string | undefined): UseQueryResult<RideRatingDto[]> {
  return useQuery({
    queryKey: [...rideQueryKeys.all, 'ratings', rideId ?? ''],
    queryFn: rideId !== undefined ? () => sdk.rides.listRideRatings(rideId) : skipToken,
  });
}
