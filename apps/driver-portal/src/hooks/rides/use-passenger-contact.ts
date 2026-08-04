'use client';

import { useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RidePassengerContactDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 2 — one-tap phone calling. Only call this while
 * `rideId` is a ride already known to be assigned/arrived/in-progress
 * (`enabled` gates on that) — a 404 here just means the contact isn't
 * resolvable right now (e.g. the ride just ended), not a hard error, so
 * callers should render nothing rather than an error state on failure. */
export function usePassengerContact(
  rideId: string | null,
): UseQueryResult<RidePassengerContactDto> {
  return useQuery({
    queryKey: [...rideQueryKeys.active(), 'passenger-contact', rideId],
    queryFn: () => sdk.rideContact.getActiveContact(),
    enabled: rideId !== null,
    retry: false,
  });
}
