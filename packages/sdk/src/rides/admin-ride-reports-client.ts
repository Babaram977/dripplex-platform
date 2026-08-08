import type { HttpClient } from '../client/http-client.js';
import type { RideProblemReportDto, RideProblemStatus } from '@dripplex/types';

/**
 * DPX-DRIVER-012 — admin surface for AdminRideReportsController
 * (apps/backend/src/rides/controllers/admin-ride-reports.controller.ts).
 * Requires `admin:rides:support`.
 */
export class AdminRideReportsClient {
  public constructor(private readonly http: HttpClient) {}

  /** List ride problem reports, optionally filtered by status. */
  public list(status?: RideProblemStatus): Promise<RideProblemReportDto[]> {
    const query = status !== undefined ? `?status=${encodeURIComponent(status)}` : '';
    return this.http.request<RideProblemReportDto[]>(`/admin/ride-reports${query}`, {
      method: 'GET',
      auth: true,
    });
  }

  /** Mark a ride problem report resolved. */
  public resolve(id: string): Promise<RideProblemReportDto> {
    return this.http.request<RideProblemReportDto>(`/admin/ride-reports/${id}/resolve`, {
      method: 'POST',
      auth: true,
    });
  }
}
