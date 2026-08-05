'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  DispatchPerformanceAnalyticsDto,
  DriverUtilizationAnalyticsDto,
  GeographicDemandAnalyticsDto,
  OperationsAnalyticsOverviewDto,
  OperationsResponseAnalyticsDto,
  RideOperationsAnalyticsDto,
  ShiftAnalyticsDto,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

interface Range {
  from: string;
  to: string;
}

/** DPX-OPS-001 Slice 4 — Operations Analytics. Unlike the live
 * fleet/queue/dispatch screens (15s polling — "what's happening right
 * now"), analytics is a decision-support view over a selected historical
 * range, not a live board — no auto-refetch interval. The range is part of
 * the query key, so switching presets (or editing a custom range)
 * refetches automatically; an operator can still pull-to-refresh via
 * `refetch()` or a page revisit. */

export function useAnalyticsOverview(range: Range): UseQueryResult<OperationsAnalyticsOverviewDto> {
  return useQuery({
    queryKey: ['operations-analytics-overview', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getOverview(range),
  });
}

export function useDriverUtilizationAnalytics(
  range: Range,
): UseQueryResult<DriverUtilizationAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-driver-utilization', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getDriverUtilization(range),
  });
}

export function useShiftAnalytics(range: Range): UseQueryResult<ShiftAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-shifts', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getShiftAnalytics(range),
  });
}

export function useRideOperationsAnalytics(
  range: Range,
): UseQueryResult<RideOperationsAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-rides', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getRideOperations(range),
  });
}

export function useDispatchPerformanceAnalytics(
  range: Range,
): UseQueryResult<DispatchPerformanceAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-dispatch', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getDispatchPerformance(range),
  });
}

export function useOperationsResponseAnalytics(
  range: Range,
): UseQueryResult<OperationsResponseAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-response', range.from, range.to],
    queryFn: () => sdk.operationsAnalytics.getOperationsResponse(range),
  });
}

export function useGeographicDemandAnalytics(
  range: Range,
  cellSizeDegrees?: number,
): UseQueryResult<GeographicDemandAnalyticsDto> {
  return useQuery({
    queryKey: ['operations-analytics-geography', range.from, range.to, cellSizeDegrees],
    queryFn: () => sdk.operationsAnalytics.getGeographicDemand({ ...range, cellSizeDegrees }),
  });
}
