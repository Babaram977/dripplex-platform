import type { HttpClient } from '../client/http-client.js';
import type { RidePassengerContactDto } from '@dripplex/types';

/**
 * Driver Slice 2 item 2 — one-tap phone calling. Mirrors
 * DriverRideContactController exactly
 * (apps/backend/src/drivers/controllers/driver-ride-contact.controller.ts).
 */
export class DriverRideContactClient {
  public constructor(private readonly http: HttpClient) {}

  /** Throws (404) when the driver has no active ride right now — callers
   * should only invoke this while a ride is already known to be assigned/
   * arrived/in-progress, and should treat a failure as "no contact to
   * show" rather than a hard error. */
  public getActiveContact(): Promise<RidePassengerContactDto> {
    return this.http.request<RidePassengerContactDto>('/driver/ride-contact/active', {
      method: 'GET',
      auth: true,
    });
  }
}
