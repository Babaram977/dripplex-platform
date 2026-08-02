'use client';

import { useMutation } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { EstimateRideFareRequest, EstimateRideFareResponse } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

/** POST /customer/rides/estimate — reuses the same pricing logic requestRide() uses internally. */
export function useEstimateFare(): UseMutationResult<
  EstimateRideFareResponse,
  Error,
  EstimateRideFareRequest
> {
  return useMutation({
    mutationFn: (body: EstimateRideFareRequest) => sdk.rides.estimateFare(body),
  });
}
