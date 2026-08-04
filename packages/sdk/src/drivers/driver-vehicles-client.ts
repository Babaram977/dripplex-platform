import type { HttpClient } from '../client/http-client.js';
import type { CreateVehicleRequest, UpdateVehicleRequest, VehicleDto } from '@dripplex/types';

/**
 * DPX-DRIVER-002 — driver-side vehicle management. Mirrors
 * DriverVehiclesController exactly
 * (apps/backend/src/drivers/controllers/driver-vehicles.controller.ts).
 */
export class DriverVehiclesClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<VehicleDto[]> {
    return this.http.request<VehicleDto[]>('/driver/vehicles', { method: 'GET', auth: true });
  }

  public getOwn(id: string): Promise<VehicleDto> {
    return this.http.request<VehicleDto>(`/driver/vehicles/${id}`, { method: 'GET', auth: true });
  }

  public create(body: CreateVehicleRequest): Promise<VehicleDto> {
    return this.http.request<VehicleDto>('/driver/vehicles', { method: 'POST', body, auth: true });
  }

  public update(id: string, body: UpdateVehicleRequest): Promise<VehicleDto> {
    return this.http.request<VehicleDto>(`/driver/vehicles/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
