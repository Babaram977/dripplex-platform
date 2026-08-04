import type { HttpClient } from '../client/http-client.js';
import type { CustomerDeliveryDto, DeliveryEtaDto, DeliveryTrackingDto } from '@dripplex/types';

export class DeliveryClient {
  public constructor(private readonly http: HttpClient) {}

  public getDelivery(orderId: string): Promise<CustomerDeliveryDto> {
    return this.http.request<CustomerDeliveryDto>(`/customer/orders/${orderId}/delivery`, {
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
