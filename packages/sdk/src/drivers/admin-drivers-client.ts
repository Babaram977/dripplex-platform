import type { HttpClient } from '../client/http-client.js';
import type {
  DriverActivationEligibilityDto,
  DriverProfileDto,
  DriverStatus,
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

export interface ListDriversQuery {
  page?: number;
  limit?: number;
  status?: DriverStatus;
}

export interface PaginatedDriversResult {
  items: DriverProfileDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * DPX-DRIVER-002 Phase 4 — admin-facing surface for AdminDriversController.
 * Slice 5 (DPX-COMMERCIAL-001) adds `listDrivers`/`getDriver` — needed for
 * the Admin Portal's driver commission-account picker, closing part of a
 * documented gap. The rest of AdminDriversController's
 * approve/reject/suspend/reactivate endpoints still predate this client
 * and don't have SDK coverage yet — unrelated to this slice.
 */
export class AdminDriversClient {
  public constructor(private readonly http: HttpClient) {}

  public getActivationEligibility(driverId: string): Promise<DriverActivationEligibilityDto> {
    return this.http.request<DriverActivationEligibilityDto>(
      `/admin/driver/${driverId}/activation-eligibility`,
      { method: 'GET', auth: true },
    );
  }

  public listDrivers(query: ListDriversQuery = {}): Promise<PaginatedDriversResult> {
    return this.http.request<PaginatedDriversResult>(`/admin/drivers${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getDriver(driverId: string): Promise<DriverProfileDto> {
    return this.http.request<DriverProfileDto>(`/admin/driver/${driverId}`, {
      method: 'GET',
      auth: true,
    });
  }
}
