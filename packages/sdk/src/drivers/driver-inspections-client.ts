import type { HttpClient } from '../client/http-client.js';
import type {
  InspectionCentreDto,
  InspectionDto,
  ScheduleInspectionRequest,
} from '@dripplex/types';

/**
 * DPX-DRIVER-002 Phase 3 — driver-side inspection booking. Mirrors
 * DriverInspectionsController exactly
 * (apps/backend/src/drivers/controllers/driver-inspections.controller.ts).
 */
export class DriverInspectionsClient {
  public constructor(private readonly http: HttpClient) {}

  public listCentres(): Promise<InspectionCentreDto[]> {
    return this.http.request<InspectionCentreDto[]>('/driver/inspections/centres', {
      method: 'GET',
      auth: true,
    });
  }

  public listOwn(): Promise<InspectionDto[]> {
    return this.http.request<InspectionDto[]>('/driver/inspections', { method: 'GET', auth: true });
  }

  public getOwn(id: string): Promise<InspectionDto> {
    return this.http.request<InspectionDto>(`/driver/inspections/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public schedule(body: ScheduleInspectionRequest): Promise<InspectionDto> {
    return this.http.request<InspectionDto>('/driver/inspections', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public cancel(id: string): Promise<InspectionDto> {
    return this.http.request<InspectionDto>(`/driver/inspections/${id}/cancel`, {
      method: 'POST',
      auth: true,
    });
  }
}
