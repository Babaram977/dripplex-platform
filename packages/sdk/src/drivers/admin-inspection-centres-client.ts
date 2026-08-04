import type { HttpClient } from '../client/http-client.js';
import type {
  CreateInspectionCentreRequest,
  InspectionCentreDto,
  UpdateInspectionCentreRequest,
} from '@dripplex/types';

/**
 * DPX-DRIVER-002 Phase 3 — inspection centre management within the existing
 * Operations/Admin Portal. Mirrors AdminInspectionCentresController exactly
 * (apps/backend/src/drivers/controllers/admin-inspection-centres.controller.ts).
 */
export class AdminInspectionCentresClient {
  public constructor(private readonly http: HttpClient) {}

  public list(): Promise<InspectionCentreDto[]> {
    return this.http.request<InspectionCentreDto[]>('/admin/inspection-centres', {
      method: 'GET',
      auth: true,
    });
  }

  public get(id: string): Promise<InspectionCentreDto> {
    return this.http.request<InspectionCentreDto>(`/admin/inspection-centres/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public create(body: CreateInspectionCentreRequest): Promise<InspectionCentreDto> {
    return this.http.request<InspectionCentreDto>('/admin/inspection-centres', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public update(id: string, body: UpdateInspectionCentreRequest): Promise<InspectionCentreDto> {
    return this.http.request<InspectionCentreDto>(`/admin/inspection-centres/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
