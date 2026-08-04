import type { HttpClient } from '../client/http-client.js';
import type { PaginatedResult, VehicleApprovalStatus, VehicleDto } from '@dripplex/types';

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

export interface ListVehiclesQuery {
  page?: number;
  limit?: number;
  approvalStatus?: VehicleApprovalStatus;
}

/**
 * DPX-DRIVER-002 — admin vehicle review workflow. Mirrors
 * AdminDriverVehiclesController exactly
 * (apps/backend/src/drivers/controllers/admin-driver-vehicles.controller.ts).
 */
export class AdminDriverVehiclesClient {
  public constructor(private readonly http: HttpClient) {}

  public list(query: ListVehiclesQuery = {}): Promise<PaginatedResult<VehicleDto>> {
    return this.http.request<PaginatedResult<VehicleDto>>(`/admin/vehicles${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public approve(id: string): Promise<VehicleDto> {
    return this.http.request<VehicleDto>(`/admin/vehicles/${id}/approve`, {
      method: 'POST',
      auth: true,
    });
  }

  public reject(id: string, rejectedReason: string): Promise<VehicleDto> {
    return this.http.request<VehicleDto>(`/admin/vehicles/${id}/reject`, {
      method: 'POST',
      body: { rejectedReason },
      auth: true,
    });
  }
}
