import type { HttpClient } from '../client/http-client.js';
import type {
  IncidentQueueDto,
  OperationsLifecycleStatus,
  OperationsPriority,
  SosQueueDto,
  SupportQueueDto,
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

export interface OperationsQueueQuery {
  status?: OperationsLifecycleStatus;
  priority?: OperationsPriority;
  assignedToId?: string;
  driverId?: string;
  /** ISO date (`YYYY-MM-DD`) or full ISO instant. */
  dateFrom?: string;
  dateTo?: string;
  /** Only matches SOS/Incident cases — `DriverSupportTicket` has no ride
   * association, so this always yields an empty Support queue. */
  rideId?: string;
  /** Only matches SOS cases — only `SosAlert` stores a vehicle id. */
  vehicleId?: string;
}

/**
 * DPX-OPS-001 Slice 2 — the three Operations Work Queues. Mirrors
 * OperationsQueuesController exactly
 * (apps/backend/src/operations/controllers/operations-queues.controller.ts).
 */
export class OperationsQueuesClient {
  public constructor(private readonly http: HttpClient) {}

  public getSosQueue(query: OperationsQueueQuery = {}): Promise<SosQueueDto> {
    return this.http.request<SosQueueDto>(`/operations/queues/sos${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getIncidentQueue(query: OperationsQueueQuery = {}): Promise<IncidentQueueDto> {
    return this.http.request<IncidentQueueDto>(`/operations/queues/incidents${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getSupportQueue(query: OperationsQueueQuery = {}): Promise<SupportQueueDto> {
    return this.http.request<SupportQueueDto>(`/operations/queues/support${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }
}
