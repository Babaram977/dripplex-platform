import type { HttpClient } from '../client/http-client.js';
import type {
  IncidentReportDto,
  IncidentReportListDto,
  ListIncidentReportsQuery,
  UpdateIncidentReportRequest,
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
 * DPX-DRIVER-012 — admin surface for AdminIncidentReportsController
 * (apps/backend/src/drivers/controllers/admin-incident-reports.controller.ts).
 * Requires `admin:drivers:incident-report:manage`.
 */
export class AdminIncidentReportsClient {
  public constructor(private readonly http: HttpClient) {}

  /** Incident-report queue. */
  public list(query: ListIncidentReportsQuery = {}): Promise<IncidentReportListDto> {
    return this.http.request<IncidentReportListDto>(`/admin/incident-reports${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  /** Acknowledge / resolve an incident report. */
  public update(id: string, body: UpdateIncidentReportRequest): Promise<IncidentReportDto> {
    return this.http.request<IncidentReportDto>(`/admin/incident-reports/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
