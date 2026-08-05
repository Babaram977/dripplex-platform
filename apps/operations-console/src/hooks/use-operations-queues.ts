'use client';

import { useQuery } from '@tanstack/react-query';

import type { IncidentQueueDto, SosQueueDto, SupportQueueDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 2 — the three Operations Work Queues. Same 15s poll
 * cadence as Slice 1's dashboard: these are "who needs help right now"
 * screens, not background summaries. */
export const operationsQueueKeys = {
  sos: ['operations-sos-queue'] as const,
  incidents: ['operations-incident-queue'] as const,
  support: ['operations-support-queue'] as const,
};

export function useSosQueue(): UseQueryResult<SosQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.sos,
    queryFn: () => sdk.operationsQueues.getSosQueue(),
    refetchInterval: 15_000,
  });
}

export function useIncidentQueue(): UseQueryResult<IncidentQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.incidents,
    queryFn: () => sdk.operationsQueues.getIncidentQueue(),
    refetchInterval: 15_000,
  });
}

export function useSupportQueue(): UseQueryResult<SupportQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.support,
    queryFn: () => sdk.operationsQueues.getSupportQueue(),
    refetchInterval: 15_000,
  });
}
