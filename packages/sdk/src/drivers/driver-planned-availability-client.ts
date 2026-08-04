import type { HttpClient } from '../client/http-client.js';
import type {
  DriverPlannedAvailabilityDto,
  SetDriverPlannedAvailabilityRequest,
} from '@dripplex/types';

/**
 * Driver-side planned-availability HTTP surface — mirrors
 * DriverPlannedAvailabilityController exactly
 * (apps/backend/src/drivers/controllers/driver-planned-availability.controller.ts).
 */
export class DriverPlannedAvailabilityClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<DriverPlannedAvailabilityDto[]> {
    return this.http.request<DriverPlannedAvailabilityDto[]>('/driver/planned-availability', {
      method: 'GET',
      auth: true,
    });
  }

  public create(body: SetDriverPlannedAvailabilityRequest): Promise<DriverPlannedAvailabilityDto> {
    return this.http.request<DriverPlannedAvailabilityDto>('/driver/planned-availability', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public remove(id: string): Promise<undefined> {
    return this.http.request<undefined>(`/driver/planned-availability/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }
}
