import type { HttpClient } from '../client/http-client.js';
import type {
  DriverActivationEligibilityDto,
  DriverApprovalDto,
  DriverKycDto,
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
 * Slice 5 (DPX-COMMERCIAL-001) added `listDrivers`/`getDriver` — needed for
 * the Admin Portal's driver commission-account picker.
 * DPX-DRIVER-006 adds the admin driver-lifecycle actions
 * (`approveDriver`/`rejectDriver`/`suspendDriver`/`reactivateDriver`),
 * closing the SDK gap the Driver kickoff audit flagged: these
 * AdminDriversController endpoints previously had no SDK coverage. This
 * client now mirrors AdminDriversController exactly.
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

  /**
   * Approve a driver application. No body — the backend re-evaluates the
   * unified activation gate (DriverActivationService) and moves the driver to
   * APPROVED, or throws if not eligible. Requires `admin:drivers:approve`.
   */
  public approveDriver(driverId: string): Promise<DriverApprovalDto> {
    return this.http.request<DriverApprovalDto>(`/admin/driver/${driverId}/approve`, {
      method: 'POST',
      auth: true,
    });
  }

  /**
   * Reject a driver application with a required reason (5–1000 chars).
   * Requires `admin:drivers:reject`.
   */
  public rejectDriver(driverId: string, reason: string): Promise<DriverApprovalDto> {
    return this.http.request<DriverApprovalDto>(`/admin/driver/${driverId}/reject`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  /**
   * Suspend an active driver with a required reason (5–1000 chars).
   * Requires `admin:drivers:suspend`.
   */
  public suspendDriver(driverId: string, reason: string): Promise<DriverApprovalDto> {
    return this.http.request<DriverApprovalDto>(`/admin/driver/${driverId}/suspend`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  /**
   * Reactivate a suspended driver. No body — the backend re-checks the
   * activation gate before returning the driver to APPROVED. Requires
   * `admin:drivers:reactivate`.
   */
  public reactivateDriver(driverId: string): Promise<DriverApprovalDto> {
    return this.http.request<DriverApprovalDto>(`/admin/driver/${driverId}/reactivate`, {
      method: 'POST',
      auth: true,
    });
  }

  /**
   * DPX-DRIVER-008 — verify a single submitted driver KYC document.
   * Optional `remarks`. Requires `admin:drivers:approve`.
   */
  public verifyKyc(kycId: string, remarks?: string): Promise<DriverKycDto> {
    return this.http.request<DriverKycDto>(`/admin/driver/kyc/${kycId}/verify`, {
      method: 'POST',
      ...(remarks !== undefined ? { body: { remarks } } : {}),
      auth: true,
    });
  }

  /**
   * DPX-DRIVER-008 — reject a single submitted driver KYC document with a
   * required reason (3–1000 chars). Requires `admin:drivers:reject`.
   */
  public rejectKyc(kycId: string, remarks: string): Promise<DriverKycDto> {
    return this.http.request<DriverKycDto>(`/admin/driver/kyc/${kycId}/reject`, {
      method: 'POST',
      body: { remarks },
      auth: true,
    });
  }
}
