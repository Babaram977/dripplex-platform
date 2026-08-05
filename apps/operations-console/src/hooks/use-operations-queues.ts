'use client';

import { useQuery } from '@tanstack/react-query';

import type { IncidentQueueDto, SosQueueDto, SupportQueueDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Filters common to all three queue screens — mirrors
 * `OperationsQueueQuery` in `packages/sdk/src/operations/
 * operations-queues-client.ts` structurally (the SDK client method just
 * needs an object shaped like this, so this stays a plain local type
 * rather than importing the SDK's). `dateFrom`/`dateTo` are ISO date
 * strings (`YYYY-MM-DD`); `rideId` only ever matches SOS/Incident cases,
 * `vehicleId` only ever matches SOS cases — see the founder's decision
 * (2026-08-05) recorded in `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`
 * not to modify the frozen Driver Slice 2 schema to add those columns
 * everywhere. */
export interface QueueFilters {
  dateFrom?: string;
  dateTo?: string;
  rideId?: string;
  vehicleId?: string;
}

const SOS_PREFIX = ['operations-sos-queue'] as const;
const INCIDENTS_PREFIX = ['operations-incident-queue'] as const;
const SUPPORT_PREFIX = ['operations-support-queue'] as const;

/** DPX-OPS-001 Slice 2 — the three Operations Work Queues. Same 15s poll
 * cadence as Slice 1's dashboard: these are "who needs help right now"
 * screens, not background summaries. Filters are part of the query key so
 * each distinct filter combination gets its own cache entry and its own
 * poll. The bare `*Prefix` keys are for `invalidateQueries` — TanStack
 * Query prefix-matches on them, invalidating every filter combination at
 * once (used by `useUpdateCase`/`useAddCaseNote` in `use-operations-
 * case.ts`, which don't know which filter view is on screen). */
export const operationsQueueKeys = {
  sos: (filters: QueueFilters = {}) => [...SOS_PREFIX, filters] as const,
  incidents: (filters: QueueFilters = {}) => [...INCIDENTS_PREFIX, filters] as const,
  support: (filters: QueueFilters = {}) => [...SUPPORT_PREFIX, filters] as const,
  sosPrefix: SOS_PREFIX,
  incidentsPrefix: INCIDENTS_PREFIX,
  supportPrefix: SUPPORT_PREFIX,
};

export function useSosQueue(filters: QueueFilters = {}): UseQueryResult<SosQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.sos(filters),
    queryFn: () => sdk.operationsQueues.getSosQueue(filters),
    refetchInterval: 15_000,
  });
}

export function useIncidentQueue(filters: QueueFilters = {}): UseQueryResult<IncidentQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.incidents(filters),
    queryFn: () => sdk.operationsQueues.getIncidentQueue(filters),
    refetchInterval: 15_000,
  });
}

export function useSupportQueue(filters: QueueFilters = {}): UseQueryResult<SupportQueueDto> {
  return useQuery({
    queryKey: operationsQueueKeys.support(filters),
    queryFn: () => sdk.operationsQueues.getSupportQueue(filters),
    refetchInterval: 15_000,
  });
}
