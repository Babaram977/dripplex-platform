import type { HttpClient } from '../client/http-client.js';
import type { CreateDriverSupportTicketRequest, DriverSupportTicketDto } from '@dripplex/types';

/**
 * Driver-side support-ticket HTTP surface — mirrors DriverSupportController
 * exactly (apps/backend/src/drivers/controllers/driver-support.controller.ts).
 */
export class DriverSupportClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<DriverSupportTicketDto[]> {
    return this.http.request<DriverSupportTicketDto[]>('/driver/support-tickets', {
      method: 'GET',
      auth: true,
    });
  }

  public getOwn(id: string): Promise<DriverSupportTicketDto> {
    return this.http.request<DriverSupportTicketDto>(`/driver/support-tickets/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public create(body: CreateDriverSupportTicketRequest): Promise<DriverSupportTicketDto> {
    return this.http.request<DriverSupportTicketDto>('/driver/support-tickets', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
