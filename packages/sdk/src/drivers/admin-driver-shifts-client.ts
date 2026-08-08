import type { HttpClient } from '../client/http-client.js';
import type {
  DriverShiftDto,
  DriverShiftListDto,
  ForceEndDriverShiftRequest,
  ListDriverShiftsQuery,
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
 * DPX-DRIVER-012 — admin surface for AdminDriverShiftsController
 * (apps/backend/src/drivers/controllers/admin-driver-shifts.controller.ts).
 * Requires `admin:drivers:shifts:manage`.
 */
export class AdminDriverShiftsClient {
  public constructor(private readonly http: HttpClient) {}

  /** Paginated shift list for ops visibility. */
  public list(query: ListDriverShiftsQuery = {}): Promise<DriverShiftListDto> {
    return this.http.request<DriverShiftListDto>(`/admin/driver-shifts${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  /** Force-end an abandoned shift. */
  public forceEnd(id: string, body: ForceEndDriverShiftRequest = {}): Promise<DriverShiftDto> {
    return this.http.request<DriverShiftDto>(`/admin/driver-shifts/${id}/end`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
