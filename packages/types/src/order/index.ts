/// DPX-CORE-003 — the universal order lifecycle shared by every commerce
/// vertical. `FAILED` is a legacy value no longer produced; see the
/// backend's OrderStatus doc comment in schema.prisma.
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'FAILED';

export type OrderCancelledBy = 'CUSTOMER' | 'MERCHANT' | 'ADMIN' | 'SYSTEM';

export type OrderDisputeStatus = 'OPEN' | 'RESOLVED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUND';

export type FulfillmentType = 'DELIVERY' | 'PICKUP';

/// How the customer chose to pay — distinct from the gateway-only
/// PaymentProvider type. WALLET and CASH never produce a
/// PaymentTransactionDto; mirrors RidePaymentMethod's separation.
export type OrderPaymentMethod = 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY' | 'WALLET' | 'CASH';

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  merchantId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  snapshotName: string;
  snapshotImage: string | null;
  snapshotSku: string | null;
  createdAt: string;
}

export interface InventoryReservationDto {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  expiresAt: string;
  releasedAt: string | null;
  createdAt: string;
}

export interface OrderDisputeDto {
  id: string;
  orderId: string;
  raisedBy: string;
  reason: string;
  status: OrderDisputeStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface OrderDto {
  id: string;
  customerId: string;
  merchantId: string;
  cartId: string | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: OrderPaymentMethod | null;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  couponCode: string | null;
  deliveryAddressId: string | null;
  notes: string | null;
  currency: string;
  estimatedReadyAt: string | null;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: OrderCancelledBy | null;
  cancellationReason: string | null;
  refundedAt: string | null;
  items: OrderItemDto[];
  reservations: InventoryReservationDto[];
  disputes: OrderDisputeDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutDto {
  cartId?: string;
  fulfillmentType?: FulfillmentType;
  deliveryAddressId?: string;
  couponCode?: string;
  notes?: string;
}

export interface CheckoutResponseDto {
  order: OrderDto;
}

export interface CancelOrderDto {
  reason?: string;
}

export interface RaiseOrderDisputeDto {
  reason: string;
}

export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
}

export interface AdminListOrdersQuery extends ListOrdersQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  merchantId?: string;
  customerId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export const ORDER_AUDIT_ACTIONS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
} as const;

export type OrderAuditAction = (typeof ORDER_AUDIT_ACTIONS)[keyof typeof ORDER_AUDIT_ACTIONS];
