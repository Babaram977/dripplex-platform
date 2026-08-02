'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { NearbyDriversQuery } from '@dripplex/sdk';
import type { NearbyDriverDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

/** Polled while the Home screen is showing a pre-booking map, so the
 * "drivers nearby" pins stay roughly current without a dedicated socket
 * channel — matches the 15-30s poll interval used elsewhere for
 * availability-style data (e.g. driver-portal's useActiveRide). */
export function useNearbyDrivers(
  query: NearbyDriversQuery | undefined,
): UseQueryResult<NearbyDriverDto[]> {
  return useQuery({
    queryKey: ['rides', 'nearby-drivers', query],
    queryFn: query !== undefined ? () => sdk.rides.getNearbyDrivers(query) : skipToken,
    refetchInterval: 20_000,
  });
}
