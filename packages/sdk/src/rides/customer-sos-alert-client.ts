import type { HttpClient } from '../client/http-client.js';
import type { SosAlertDto, TriggerSosAlertRequest } from '@dripplex/types';

/**
 * Passenger-side SOS/emergency-alert HTTP surface — mirrors
 * CustomerSosAlertsController exactly
 * (apps/backend/src/drivers/controllers/customer-sos-alerts.controller.ts).
 *
 * `trigger()` is only accepted during an active ride; outside one the
 * backend returns a validation error rather than filing an alert
 * Operations cannot act on. Callers should surface that message, not
 * swallow it — see DPX-SAFETY-001.
 */
export class CustomerSosAlertClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<SosAlertDto[]> {
    return this.http.request<SosAlertDto[]>('/customer/sos-alerts', {
      method: 'GET',
      auth: true,
    });
  }

  public getOwn(id: string): Promise<SosAlertDto> {
    return this.http.request<SosAlertDto>(`/customer/sos-alerts/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public trigger(body: TriggerSosAlertRequest = {}): Promise<SosAlertDto> {
    return this.http.request<SosAlertDto>('/customer/sos-alerts', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
