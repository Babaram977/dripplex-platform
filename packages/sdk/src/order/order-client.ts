import type { HttpClient } from '../client/http-client.js';
import type {
  AcceptOrderRequest,
  AdminListOrdersQuery,
  CancelOrderDto,
  CheckoutDto,
  CheckoutResponseDto,
  DelayOrderRequest,
  InitializePaymentDto,
  InitializePaymentResponseDto,
  ListOrdersQuery,
  MerchantCancelOrderRequest,
  MerchantOrderListQuery,
  OrderDto,
  PaginatedResult,
  PaymentStatusDto,
  PaymentVerificationDto,
  RaiseOrderDisputeDto,
  RejectOrderRequest,
} from '@dripplex/types';

function toQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export class OrderClient {
  public constructor(private readonly http: HttpClient) {}

  public checkout(body: CheckoutDto = {}): Promise<CheckoutResponseDto> {
    return this.http.request<CheckoutResponseDto>('/customer/checkout', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public getOrders(query: ListOrdersQuery = {}): Promise<PaginatedResult<OrderDto>> {
    return this.http.request<PaginatedResult<OrderDto>>(
      `/customer/orders${toQuery({
        page: query.page,
        pageSize: query.pageSize,
      })}`,
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  public getOrder(id: string): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/customer/orders/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public cancelOrder(id: string, body: CancelOrderDto = {}): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/customer/orders/${id}/cancel`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public raiseDispute(id: string, body: RaiseOrderDisputeDto): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/customer/orders/${id}/dispute`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

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

  public adminGetOrders(query: AdminListOrdersQuery = {}): Promise<PaginatedResult<OrderDto>> {
    return this.http.request<PaginatedResult<OrderDto>>(
      `/admin/orders${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        paymentStatus: query.paymentStatus,
        merchantId: query.merchantId,
        customerId: query.customerId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      })}`,
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  public adminGetOrder(id: string): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/admin/orders/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  /**
   * Merchant order lifecycle — matches `MerchantOrdersController`
   * (`apps/backend/src/orders/merchant-orders.controller.ts`) 1:1. Closes
   * the SDK gap `merchant-flow.e2e.spec.ts` documented (no merchant order
   * accept/prepare/ready endpoints on the SDK) — see
   * DPX-MERCHANT-001-REALITY-AUDIT.md.
   */
  public merchantGetOrders(query: MerchantOrderListQuery = {}): Promise<PaginatedResult<OrderDto>> {
    return this.http.request<PaginatedResult<OrderDto>>(
      `/merchant/orders${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      })}`,
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  public merchantGetOrder(id: string): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public merchantAcceptOrder(id: string, body: AcceptOrderRequest = {}): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}/accept`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public merchantRejectOrder(id: string, body: RejectOrderRequest): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}/reject`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public merchantMarkOrderReady(id: string): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}/ready`, {
      method: 'PATCH',
      auth: true,
    });
  }

  public merchantDelayOrder(id: string, body: DelayOrderRequest): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}/delay`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public merchantCancelOrder(id: string, body: MerchantCancelOrderRequest = {}): Promise<OrderDto> {
    return this.http.request<OrderDto>(`/merchant/orders/${id}/cancel`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
