import type { HttpClient } from '../client/http-client.js';
import type { SosAlertDto, TriggerSosAlertRequest } from '@dripplex/types';

/**
 * Driver-side SOS/emergency-alert HTTP surface — mirrors
 * DriverSosAlertsController exactly
 * (apps/backend/src/drivers/controllers/driver-sos-alerts.controller.ts).
 */
export class DriverSosAlertClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<SosAlertDto[]> {
    return this.http.request<SosAlertDto[]>('/driver/sos-alerts', {
      method: 'GET',
      auth: true,
    });
  }

  public getOwn(id: string): Promise<SosAlertDto> {
    return this.http.request<SosAlertDto>(`/driver/sos-alerts/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public trigger(body: TriggerSosAlertRequest = {}): Promise<SosAlertDto> {
    return this.http.request<SosAlertDto>('/driver/sos-alerts', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
