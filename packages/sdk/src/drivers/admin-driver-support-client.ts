import type { HttpClient } from '../client/http-client.js';
import type {
  DriverSupportTicketDto,
  DriverSupportTicketListDto,
  ListDriverSupportTicketsQuery,
  UpdateDriverSupportTicketRequest,
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

/**
 * DPX-DRIVER-012 — admin surface for AdminDriverSupportController
 * (apps/backend/src/drivers/controllers/admin-driver-support.controller.ts).
 * Requires `admin:drivers:support-ticket:manage`.
 */
export class AdminDriverSupportClient {
  public constructor(private readonly http: HttpClient) {}

  /** Driver support-ticket queue. */
  public list(query: ListDriverSupportTicketsQuery = {}): Promise<DriverSupportTicketListDto> {
    return this.http.request<DriverSupportTicketListDto>(
      `/admin/driver-support-tickets${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  /** Respond to / resolve a support ticket. */
  public update(
    id: string,
    body: UpdateDriverSupportTicketRequest,
  ): Promise<DriverSupportTicketDto> {
    return this.http.request<DriverSupportTicketDto>(`/admin/driver-support-tickets/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
