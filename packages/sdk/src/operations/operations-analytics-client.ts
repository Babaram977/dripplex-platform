import type { HttpClient } from '../client/http-client.js';
import type {
  DispatchPerformanceAnalyticsDto,
  DriverUtilizationAnalyticsDto,
  GeographicDemandAnalyticsDto,
  OperationsAnalyticsOverviewDto,
  OperationsResponseAnalyticsDto,
  RideOperationsAnalyticsDto,
  ShiftAnalyticsDto,
} from '@dripplex/types';

function toQuery(params: object): string {
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

export interface AnalyticsRangeQuery {
  /** ISO date (`YYYY-MM-DD`) or full ISO instant. Always required —
   * `operations-console` computes "Today"/"Last 7 days"/"Last 30 days"/
   * custom into concrete timestamps before calling. */
  from: string;
  to: string;
}

export interface GeographicDemandQuery extends AnalyticsRangeQuery {
  /** Grid cell size in degrees. Omit to use the backend's default
   * (~1.1km). */
  cellSizeDegrees?: number;
}

/**
 * DPX-OPS-001 Slice 4 — Operations Analytics (founder-approved 2026-08-05,
 * reality-audited first — see docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md).
 * Mirrors OperationsAnalyticsController exactly
 * (apps/backend/src/operations/controllers/operations-analytics.controller.ts).
 * `operations-console` only. Named `operationsAnalytics` (not `analytics`)
 * to stay distinct from the existing Marketplace/Delivery-scoped
 * `analytics` client — the two are deliberately separate domains, per the
 * Slice 4 reality audit's decision not to reuse that dormant module.
 */
export class OperationsAnalyticsClient {
  public constructor(private readonly http: HttpClient) {}

  public getOverview(query: AnalyticsRangeQuery): Promise<OperationsAnalyticsOverviewDto> {
    return this.http.request<OperationsAnalyticsOverviewDto>(
      `/operations/analytics/overview${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getDriverUtilization(query: AnalyticsRangeQuery): Promise<DriverUtilizationAnalyticsDto> {
    return this.http.request<DriverUtilizationAnalyticsDto>(
      `/operations/analytics/driver-utilization${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getShiftAnalytics(query: AnalyticsRangeQuery): Promise<ShiftAnalyticsDto> {
    return this.http.request<ShiftAnalyticsDto>(`/operations/analytics/shifts${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getRideOperations(query: AnalyticsRangeQuery): Promise<RideOperationsAnalyticsDto> {
    return this.http.request<RideOperationsAnalyticsDto>(
      `/operations/analytics/rides${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getDispatchPerformance(
    query: AnalyticsRangeQuery,
  ): Promise<DispatchPerformanceAnalyticsDto> {
    return this.http.request<DispatchPerformanceAnalyticsDto>(
      `/operations/analytics/dispatch${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getOperationsResponse(
    query: AnalyticsRangeQuery,
  ): Promise<OperationsResponseAnalyticsDto> {
    return this.http.request<OperationsResponseAnalyticsDto>(
      `/operations/analytics/response${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getGeographicDemand(query: GeographicDemandQuery): Promise<GeographicDemandAnalyticsDto> {
    return this.http.request<GeographicDemandAnalyticsDto>(
      `/operations/analytics/geography${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }
}
