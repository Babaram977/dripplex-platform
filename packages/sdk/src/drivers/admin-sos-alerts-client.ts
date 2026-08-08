import type { HttpClient } from '../client/http-client.js';
import type {
  ListSosAlertsQuery,
  SosAlertDto,
  SosAlertListDto,
  UpdateSosAlertRequest,
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
 * DPX-DRIVER-012 — admin surface for AdminSosAlertsController
 * (apps/backend/src/drivers/controllers/admin-sos-alerts.controller.ts).
 * Requires `admin:drivers:sos-alert:manage`.
 */
export class AdminSosAlertsClient {
  public constructor(private readonly http: HttpClient) {}

  /** SOS-alert queue. */
  public list(query: ListSosAlertsQuery = {}): Promise<SosAlertListDto> {
    return this.http.request<SosAlertListDto>(`/admin/sos-alerts${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  /** Acknowledge / resolve an SOS alert. */
  public update(id: string, body: UpdateSosAlertRequest): Promise<SosAlertDto> {
    return this.http.request<SosAlertDto>(`/admin/sos-alerts/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
