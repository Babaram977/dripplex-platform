'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { rideQueryKeys } from './query-keys';

import type { RideOfferPreviewDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

export function useOfferPreview(offerId: string | undefined): UseQueryResult<RideOfferPreviewDto> {
  return useQuery({
    queryKey: rideQueryKeys.offerPreview(offerId ?? ''),
    queryFn: offerId !== undefined ? () => sdk.rides.getOfferPreview(offerId) : skipToken,
    retry: false,
  });
}
