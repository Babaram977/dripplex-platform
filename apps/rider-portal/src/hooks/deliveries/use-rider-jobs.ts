'use client';

import { useQuery } from '@tanstack/react-query';

import { riderDeliveryKeys } from './query-keys';

import type { DeliveryJobDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * The rider's active delivery jobs. Backend `GET /rider/jobs` returns only
 * jobs already assigned to this rider with an active status (ASSIGNED,
 * ACCEPTED, PICKED_UP, ON_THE_WAY, ARRIVED). There is no unclaimed-job pool
 * exposed to the rider SDK — assignment happens server-side (auto/admin).
 *
 * No delivery socket/gateway exists, so freshness comes from polling.
 */
export function useRiderJobs(): UseQueryResult<DeliveryJobDto[]> {
  return useQuery({
    queryKey: riderDeliveryKeys.jobs(),
    queryFn: () => sdk.riderDelivery.listJobs(),
    refetchInterval: 15_000,
  });
}
