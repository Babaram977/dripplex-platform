'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateRideSurchargeZoneRequest,
  UpdateRideFareRateRequest,
  UpdateRideSurchargeZoneRequest,
} from '@dripplex/sdk';
import type { RideFareRateDto, RideSurchargeZoneDto, RideType } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const pricingKeys = {
  rates: ['admin-ride-fare-rates'] as const,
  zones: ['admin-ride-surcharge-zones'] as const,
};

/**
 * The Ops-editable ride fare table and surcharge zones.
 *
 * No refetch interval: pricing is not a live feed. One operator editing a rate
 * while another's screen silently rewrites the form under them would be worse
 * than a stale figure, and a mutation invalidates the query anyway.
 */
export function useRideFareRates(): UseQueryResult<RideFareRateDto[]> {
  return useQuery({
    queryKey: pricingKeys.rates,
    queryFn: () => sdk.adminRidePricing.listRates(),
  });
}

export function useUpdateRideFareRate(): UseMutationResult<
  RideFareRateDto,
  Error,
  { rideType: RideType; body: UpdateRideFareRateRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rideType, body }: { rideType: RideType; body: UpdateRideFareRateRequest }) =>
      sdk.adminRidePricing.updateRate(rideType, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pricingKeys.rates });
    },
  });
}

export function useRideSurchargeZones(): UseQueryResult<RideSurchargeZoneDto[]> {
  return useQuery({
    queryKey: pricingKeys.zones,
    queryFn: () => sdk.adminRidePricing.listZones(),
  });
}

function useZoneMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<RideSurchargeZoneDto>,
): UseMutationResult<RideSurchargeZoneDto, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pricingKeys.zones });
    },
  });
}

export function useCreateRideSurchargeZone(): UseMutationResult<
  RideSurchargeZoneDto,
  Error,
  CreateRideSurchargeZoneRequest
> {
  return useZoneMutation((body: CreateRideSurchargeZoneRequest) =>
    sdk.adminRidePricing.createZone(body),
  );
}

export function useUpdateRideSurchargeZone(): UseMutationResult<
  RideSurchargeZoneDto,
  Error,
  { id: string; body: UpdateRideSurchargeZoneRequest }
> {
  return useZoneMutation(({ id, body }: { id: string; body: UpdateRideSurchargeZoneRequest }) =>
    sdk.adminRidePricing.updateZone(id, body),
  );
}
