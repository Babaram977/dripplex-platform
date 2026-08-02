'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useAcceptOffer(): UseMutationResult<RideDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => sdk.rides.acceptOffer(offerId),
    onSuccess: (ride) => {
      queryClient.setQueryData(rideQueryKeys.active(), ride);
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.offers() });
    },
  });
}

export function useDeclineOffer(): UseMutationResult<null, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => sdk.rides.declineOffer(offerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rideQueryKeys.offers() });
    },
  });
}
