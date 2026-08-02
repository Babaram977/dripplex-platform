'use client';

import { useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideOfferDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * Live (PENDING, unexpired) offers for the signed-in driver. The `ride:
 * offered` WS push (see useRideOfferSocket) invalidates this query on
 * arrival, and the short poll interval is the fallback for when the socket
 * never connects — same best-effort posture as customer-web's ride hooks.
 */
export function useRideOffers(): UseQueryResult<RideOfferDto[]> {
  return useQuery({
    queryKey: rideQueryKeys.offers(),
    queryFn: () => sdk.rides.listOffers(),
    refetchInterval: 10_000,
  });
}
