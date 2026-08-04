'use client';

import { useQuery } from '@tanstack/react-query';

import type { OperationsRideQueueDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 1 — Ride Queue screen. Same 15s poll cadence as
 * `useFleetSnapshot`: this is dispatch-adjacent visibility ("what needs
 * assignment right now"), not a background summary. */
export function useRideQueue(): UseQueryResult<OperationsRideQueueDto> {
  return useQuery({
    queryKey: ['operations-ride-queue'],
    queryFn: () => sdk.operationsRides.getQueue(),
    refetchInterval: 15_000,
  });
}
