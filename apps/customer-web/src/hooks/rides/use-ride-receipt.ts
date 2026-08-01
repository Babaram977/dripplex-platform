'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type { RideReceiptDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

/** Only resolves once the ride is COMPLETED — the backend rejects it otherwise. */
export function useRideReceipt(rideId: string | undefined): UseQueryResult<RideReceiptDto> {
  return useQuery({
    queryKey: rideQueryKeys.receipt(rideId ?? ''),
    queryFn: rideId !== undefined ? () => sdk.rides.getReceipt(rideId) : skipToken,
  });
}
