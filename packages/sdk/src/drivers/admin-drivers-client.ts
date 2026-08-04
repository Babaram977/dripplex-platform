import type { HttpClient } from '../client/http-client.js';
import type { DriverActivationEligibilityDto } from '@dripplex/types';

/**
 * DPX-DRIVER-002 Phase 4 — admin-facing surface for AdminDriversController.
 * Currently scoped to the unified activation-eligibility check only; the
 * rest of AdminDriversController's approve/reject/suspend/reactivate
 * endpoints predate this client and don't have SDK coverage yet — a
 * pre-existing gap, not introduced here.
 */
export class AdminDriversClient {
  public constructor(private readonly http: HttpClient) {}

  public getActivationEligibility(driverId: string): Promise<DriverActivationEligibilityDto> {
    return this.http.request<DriverActivationEligibilityDto>(
      `/admin/driver/${driverId}/activation-eligibility`,
      { method: 'GET', auth: true },
    );
  }
}
