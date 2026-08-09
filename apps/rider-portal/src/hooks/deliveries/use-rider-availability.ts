'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { riderDeliveryKeys } from './query-keys';

import type { RiderLocationDto, UpdateRiderAvailabilityDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * POST /rider/availability — upserts the rider's online / accepting-orders
 * state. Note: the rider SDK exposes only this write endpoint; there is no
 * GET availability route for the rider, so the current state cannot be read
 * back on load. The last successful response is cached optimistically so the
 * toggle reflects what this session last set.
 */
export function useSetRiderAvailability(): UseMutationResult<
  RiderLocationDto,
  Error,
  UpdateRiderAvailabilityDto
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRiderAvailabilityDto) => sdk.riderDelivery.updateAvailability(body),
    onSuccess: (data) => {
      queryClient.setQueryData(riderDeliveryKeys.availability(), data);
    },
  });
}
