import type { HttpClient } from '../client/http-client.js';
import type { RiderApprovalDto, RiderProfileDto, RiderStatus } from '@dripplex/types';

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

export interface ListRidersQuery {
  page?: number;
  limit?: number;
  status?: RiderStatus;
}

export interface PaginatedRidersResult {
  items: RiderProfileDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * DPX-RIDER-001 — admin/ops surface for AdminRidersController. Mirrors
 * AdminDriversClient (minus the driver-only KYC/eligibility endpoints):
 * riders have no KYC/vehicle gate, so approval is a straight lifecycle
 * transition.
 */
export class AdminRidersClient {
  public constructor(private readonly http: HttpClient) {}

  public listRiders(query: ListRidersQuery = {}): Promise<PaginatedRidersResult> {
    return this.http.request<PaginatedRidersResult>(`/admin/riders${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getRider(riderId: string): Promise<RiderProfileDto> {
    return this.http.request<RiderProfileDto>(`/admin/rider/${riderId}`, {
      method: 'GET',
      auth: true,
    });
  }

  /** Approve a rider application. Requires `admin:riders:approve`. */
  public approveRider(riderId: string): Promise<RiderApprovalDto> {
    return this.http.request<RiderApprovalDto>(`/admin/rider/${riderId}/approve`, {
      method: 'POST',
      auth: true,
    });
  }

  /** Reject a rider application with a required reason (5–1000 chars). */
  public rejectRider(riderId: string, reason: string): Promise<RiderApprovalDto> {
    return this.http.request<RiderApprovalDto>(`/admin/rider/${riderId}/reject`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  /** Suspend an approved rider with a required reason (5–1000 chars). */
  public suspendRider(riderId: string, reason: string): Promise<RiderApprovalDto> {
    return this.http.request<RiderApprovalDto>(`/admin/rider/${riderId}/suspend`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  /** Reactivate a suspended rider back to APPROVED. */
  public reactivateRider(riderId: string): Promise<RiderApprovalDto> {
    return this.http.request<RiderApprovalDto>(`/admin/rider/${riderId}/reactivate`, {
      method: 'POST',
      auth: true,
    });
  }
}
