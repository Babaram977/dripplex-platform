'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { RideTrackingPointDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

/** Breadcrumb trail for a single ride — used to seed a live map's route on
 * load/reconnect and to render the traveled-route replay after a trip
 * completes (TripCompletedScreen/TripReceiptScreen). */
export function useTrackingHistory(
  rideId: string | undefined,
): UseQueryResult<RideTrackingPointDto[]> {
  return useQuery({
    queryKey: ['rides', 'tracking', rideId],
    queryFn: rideId !== undefined ? () => sdk.rides.getTrackingHistory(rideId) : skipToken,
  });
}
