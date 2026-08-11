import type { HttpClient } from '../client/http-client.js';
import type { DriverIdentityVerificationDto } from '@dripplex/types';

/**
 * DPX-DRIVER-012 — admin surface for AdminDriverIdentityVerificationController
 * (apps/backend/src/drivers/controllers/admin-driver-identity-verification.controller.ts).
 * Requires `admin:drivers:identity-verification:manage`.
 */
export class AdminDriverIdentityVerificationClient {
  public constructor(private readonly http: HttpClient) {}

  /** Force a driver into re-verification (MANUAL_ADMIN trigger). */
  public require(driverId: string): Promise<{ required: true }> {
    return this.http.request<{ required: true }>(
      `/admin/drivers/${driverId}/identity-verification/require`,
      { method: 'POST', auth: true },
    );
  }

  /**
   * Manually mark a driver's identity verified after reviewing their submitted
   * ID/KYC (MANUAL_REVIEW provider). Clears the activation identity gate and
   * any lockout. Optional `remarks` are recorded on the audit trail.
   */
  public verify(driverId: string, remarks?: string): Promise<DriverIdentityVerificationDto> {
    return this.http.request<DriverIdentityVerificationDto>(
      `/admin/drivers/${driverId}/identity-verification/verify`,
      { method: 'POST', body: remarks !== undefined ? { remarks } : {}, auth: true },
    );
  }

  /** Clear a driver identity-verification lockout. */
  public unlock(driverId: string): Promise<{ unlocked: true }> {
    return this.http.request<{ unlocked: true }>(
      `/admin/drivers/${driverId}/identity-verification/unlock`,
      { method: 'POST', auth: true },
    );
  }
}
