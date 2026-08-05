'use client';

import { useQuery } from '@tanstack/react-query';

import type { ActivityFeedDto, OperationsQueueCountersDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 2 — dashboard extension: queue counters + the Live
 * Activity Feed. Same 15s cadence as the Live Fleet Map. */
export function useDashboardCounters(): UseQueryResult<OperationsQueueCountersDto> {
  return useQuery({
    queryKey: ['operations-dashboard-counters'],
    queryFn: () => sdk.operationsDashboard.getCounters(),
    refetchInterval: 15_000,
  });
}

export function useActivityFeed(): UseQueryResult<ActivityFeedDto> {
  return useQuery({
    queryKey: ['operations-activity-feed'],
    queryFn: () => sdk.operationsDashboard.getActivityFeed(),
    refetchInterval: 15_000,
  });
}
