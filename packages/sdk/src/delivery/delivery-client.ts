import type { HttpClient } from '../client/http-client.js';
import type { DeliveryEtaDto, DeliveryJobDto, DeliveryTrackingDto } from '@dripplex/types';

export class DeliveryClient {
  public constructor(private readonly http: HttpClient) {}

  public getDelivery(orderId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/customer/orders/${orderId}/delivery`, {
      method: 'GET',
      auth: true,
    });
  }

  public getTracking(orderId: string): Promise<DeliveryTrackingDto[]> {
    return this.http.request<DeliveryTrackingDto[]>(`/customer/orders/${orderId}/tracking`, {
      method: 'GET',
      auth: true,
    });
  }

  public getEta(orderId: string): Promise<DeliveryEtaDto> {
    return this.http.request<DeliveryEtaDto>(`/customer/orders/${orderId}/eta`, {
      method: 'GET',
      auth: true,
    });
  }
}
