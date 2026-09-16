import type { HttpClient } from '../client/http-client.js';
import type {
  AcceptOrderRequest,
  AdminListOrderExceptionsQuery,
  AdminListOrdersQuery,
  CancelOrderDto,
  CheckoutDto,
  CheckoutResponseDto,
  CustomerMerchantBankDto,
  DelayOrderRequest,
  InitializePaymentDto,
  InitializePaymentResponseDto,
  ListOrdersQuery,
  MerchantCancelOrderRequest,
  MerchantOrderListQuery,
  OrderDto,
  OrderExceptionDto,
  OrderRecoveryActivationStateDto,
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

  /**
   * Read-only: the order merchant's default payout bank account, so the "Pay
   * to Merchant Bank" (MERCHANT_DIRECT) checkout option can show the customer
   * where to transfer. Requires the caller to own the order.
   */
  public getMerchantBank(orderId: string): Promise<CustomerMerchantBankDto> {
    return this.http.request<CustomerMerchantBankDto>(`/customer/orders/${orderId}/merchant-bank`, {
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

  /**
   * DPX-ORDER-8D-C ops visibility — the operations queue of stalled orders.
   *
   * Mirrors `AdminOrdersController.listOrderExceptions`
   * (`apps/backend/src/orders/admin-orders.controller.ts`) 1:1.
   *
   * READ ONLY, and there is deliberately no companion resolve/dismiss method:
   * the 2026-09-16 ruling escalates a stalled order but authorises nobody to
   * act on one. An SDK method for an action that does not exist would invite a
   * console to be built against it.
   */
  public adminGetOrderExceptions(
    query: AdminListOrderExceptionsQuery = {},
  ): Promise<PaginatedResult<OrderExceptionDto>> {
    return this.http.request<PaginatedResult<OrderExceptionDto>>(
      `/admin/orders/exceptions${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        type: query.type,
      })}`,
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  /**
   * DPX-ORDER-8D-RECOVERY — is the automatic backstop armed, and from when?
   *
   * Mirrors `AdminOrderRecoveryController.getActivationState` 1:1. READ ONLY,
   * and deliberately has no companion activate/deactivate method: the boundary
   * is a code constant changed by reviewed deployment, precisely so that no
   * runtime surface can move a financial safety boundary. An SDK method for an
   * action that does not exist would invite a console to be built against it.
   *
   * The state is returned exactly as the backend resolved it. Callers must not
   * cache it or infer OFF from a failed request — a request that failed tells
   * you nothing about whether recovery is armed.
   */
  public adminGetOrderRecoveryActivationState(): Promise<OrderRecoveryActivationStateDto> {
    return this.http.request<OrderRecoveryActivationStateDto>(
      '/admin/order-recoveries/activation-state',
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
