import type { HttpClient } from '../client/http-client.js';
import type { CreateIncidentReportRequest, IncidentReportDto } from '@dripplex/types';

/**
 * Driver-side incident-report HTTP surface — mirrors
 * DriverIncidentReportsController exactly
 * (apps/backend/src/drivers/controllers/driver-incident-reports.controller.ts).
 */
export class DriverIncidentReportClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<IncidentReportDto[]> {
    return this.http.request<IncidentReportDto[]>('/driver/incident-reports', {
      method: 'GET',
      auth: true,
    });
  }

  public getOwn(id: string): Promise<IncidentReportDto> {
    return this.http.request<IncidentReportDto>(`/driver/incident-reports/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public create(body: CreateIncidentReportRequest): Promise<IncidentReportDto> {
    return this.http.request<IncidentReportDto>('/driver/incident-reports', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
