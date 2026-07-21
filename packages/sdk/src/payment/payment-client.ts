import type { HttpClient } from '../client/http-client.js';
import type {
  InitializePaymentDto,
  InitializePaymentResponseDto,
  PaymentStatusDto,
  PaymentVerificationDto,
} from '@dripplex/types';

export class PaymentClient {
  public constructor(private readonly http: HttpClient) {}

  public payOrder(
    orderId: string,
    body: InitializePaymentDto = {},
  ): Promise<InitializePaymentResponseDto> {
    return this.http.request<InitializePaymentResponseDto>(`/customer/orders/${orderId}/pay`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public verifyOrderPayment(
    orderId: string,
    body: { reference?: string } = {},
  ): Promise<PaymentVerificationDto> {
    return this.http.request<PaymentVerificationDto>(`/customer/orders/${orderId}/verify`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public getOrderPayment(orderId: string): Promise<PaymentStatusDto> {
    return this.http.request<PaymentStatusDto>(`/customer/orders/${orderId}/payment`, {
      method: 'GET',
      auth: true,
    });
  }
}
