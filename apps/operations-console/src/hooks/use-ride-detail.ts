'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  DispatchSupportDto,
  OperationsRideAllocationDto,
  OperationsRideDetailDto,
  OperationsRideTrackingDto,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 3 — Dispatch Management ride detail view. Detail and
 * allocation history poll on the platform's established 15s cadence — the
 * same "who needs attention right now" precedent every other DPX-OPS-001
 * screen follows. */
export function useRideDetail(rideId: string): UseQueryResult<OperationsRideDetailDto> {
  return useQuery({
    queryKey: ['operations-ride-detail', rideId],
    queryFn: () => sdk.operationsRides.getRideDetail(rideId),
    refetchInterval: 15_000,
  });
}

export function useRideAllocation(rideId: string): UseQueryResult<OperationsRideAllocationDto> {
  return useQuery({
    queryKey: ['operations-ride-allocation', rideId],
    queryFn: () => sdk.operationsRides.getRideAllocation(rideId),
    refetchInterval: 15_000,
  });
}

/** Trip monitoring — same 15s cadence, per the Slice 3 reality audit's
 * finding that `RideGateway` has no operations-wide broadcast room (and
 * shouldn't gain one just for this). */
export function useTripTracking(rideId: string): UseQueryResult<OperationsRideTrackingDto> {
  return useQuery({
    queryKey: ['operations-ride-tracking', rideId],
    queryFn: () => sdk.operationsRides.getTripTracking(rideId),
    refetchInterval: 15_000,
  });
}

/** The founder's DPX-RIDE-201 decision-support panel — fetched lazily
 * (`enabled`), not on the 15s poll every other section uses. Computing
 * nearby-driver distance/rating for a ride that's already settled or
 * whose operator hasn't opened the panel is wasted work; this only runs
 * once the panel is actually expanded. */
export function useDispatchCandidates(
  rideId: string,
  enabled: boolean,
): UseQueryResult<DispatchSupportDto> {
  return useQuery({
    queryKey: ['operations-dispatch-candidates', rideId],
    queryFn: () => sdk.operationsRides.getDispatchCandidates(rideId),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}
