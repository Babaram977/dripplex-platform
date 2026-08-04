'use client';

import { useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type { RideTypeCatalogEntryDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * GET /customer/rides/types — the real service-type catalog (display name,
 * description, emoji). Static/rarely-changing, so a long staleTime avoids
 * refetching it on every screen that needs a ride-type label.
 */
export function useRideTypeCatalog(): UseQueryResult<RideTypeCatalogEntryDto[]> {
  return useQuery({
    queryKey: rideQueryKeys.types,
    queryFn: () => sdk.rides.listRideTypes(),
    staleTime: 60 * 60 * 1000,
  });
}
