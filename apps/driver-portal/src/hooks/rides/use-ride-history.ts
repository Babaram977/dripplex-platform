'use client';

import { useQuery } from '@tanstack/react-query';

import { rideQueryKeys, type DriverRideListQuery } from './query-keys';

import type { PaginatedResult, RideDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useRideHistory(
  query: DriverRideListQuery,
): UseQueryResult<PaginatedResult<RideDto>> {
  return useQuery({
    queryKey: rideQueryKeys.list(query),
    queryFn: () => sdk.rides.listOwnRides(query),
  });
}
