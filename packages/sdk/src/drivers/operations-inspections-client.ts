import type { HttpClient } from '../client/http-client.js';
import type {
  DecideInspectionRequest,
  InspectionDto,
  InspectionStatus,
  PaginatedResult,
  RecordInspectionChecklistRequest,
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

export interface ListInspectionsQuery {
  page?: number;
  limit?: number;
  status?: InspectionStatus;
  centreId?: string;
}

/**
 * DPX-DRIVER-002 Phase 3 — inspection management within the existing
 * Operations/Admin Portal (no separate Inspector app, per founder decision).
 * Mirrors OperationsInspectionsController exactly
 * (apps/backend/src/drivers/controllers/operations-inspections.controller.ts).
 * Officer capabilities use `recordChecklist`; supervisor capabilities use
 * `decide` — see driver.constants.ts's INSPECTION_CHECKLIST_MANAGE vs
 * INSPECTION_APPROVE permission split.
 */
export class OperationsInspectionsClient {
  public constructor(private readonly http: HttpClient) {}

  public list(query: ListInspectionsQuery = {}): Promise<PaginatedResult<InspectionDto>> {
    return this.http.request<PaginatedResult<InspectionDto>>(
      `/admin/inspections${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public get(id: string): Promise<InspectionDto> {
    return this.http.request<InspectionDto>(`/admin/inspections/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public recordChecklist(
    id: string,
    body: RecordInspectionChecklistRequest,
  ): Promise<InspectionDto> {
    return this.http.request<InspectionDto>(`/admin/inspections/${id}/checklist`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public decide(id: string, body: DecideInspectionRequest): Promise<InspectionDto> {
    return this.http.request<InspectionDto>(`/admin/inspections/${id}/decide`, {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
