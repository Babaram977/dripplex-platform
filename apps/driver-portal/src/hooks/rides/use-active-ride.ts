'use client';

import { useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Recovers "you have a trip in progress" after a page refresh — see
 * RidesService.getActiveRide doc comment on the backend. */
export function useActiveRide(): UseQueryResult<RideDto | null> {
  return useQuery({
    queryKey: rideQueryKeys.active(),
    queryFn: () => sdk.rides.getActiveRide(),
    refetchInterval: 15_000,
  });
}
