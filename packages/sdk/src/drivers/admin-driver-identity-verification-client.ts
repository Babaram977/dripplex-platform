import type { HttpClient } from '../client/http-client.js';

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

  /** Clear a driver identity-verification lockout. */
  public unlock(driverId: string): Promise<{ unlocked: true }> {
    return this.http.request<{ unlocked: true }>(
      `/admin/drivers/${driverId}/identity-verification/unlock`,
      { method: 'POST', auth: true },
    );
  }
}
