import type { HttpClient } from '../client/http-client.js';
import type { DriverPlannedAvailabilityDto } from '@dripplex/types';

/**
 * DPX-DRIVER-012 — admin surface for AdminDriverPlannedAvailabilityController
 * (apps/backend/src/drivers/controllers/admin-driver-planned-availability.controller.ts).
 * Requires `admin:drivers:shifts:manage`.
 */
export class AdminDriverPlannedAvailabilityClient {
  public constructor(private readonly http: HttpClient) {}

  /** List a driver's weekly planned-availability slots. */
  public list(driverId: string): Promise<DriverPlannedAvailabilityDto[]> {
    return this.http.request<DriverPlannedAvailabilityDto[]>(
      `/admin/driver-planned-availability?driverId=${encodeURIComponent(driverId)}`,
      { method: 'GET', auth: true },
    );
  }
}
