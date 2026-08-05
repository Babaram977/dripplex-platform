import type { HttpClient } from '../client/http-client.js';
import type { ActivityFeedDto, OperationsQueueCountersDto } from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 2 — the Live Fleet Map dashboard's queue-counter tiles
 * and Live Activity Feed. Mirrors OperationsDashboardController exactly
 * (apps/backend/src/operations/controllers/operations-dashboard.controller.ts).
 */
export class OperationsDashboardClient {
  public constructor(private readonly http: HttpClient) {}

  public getCounters(): Promise<OperationsQueueCountersDto> {
    return this.http.request<OperationsQueueCountersDto>('/operations/dashboard/counters', {
      method: 'GET',
      auth: true,
    });
  }

  public getActivityFeed(): Promise<ActivityFeedDto> {
    return this.http.request<ActivityFeedDto>('/operations/dashboard/activity-feed', {
      method: 'GET',
      auth: true,
    });
  }
}
