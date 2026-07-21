export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUND';

export type FulfillmentType = 'DELIVERY' | 'PICKUP';

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

export interface OrderDto {
  id: string;
  customerId: string;
  merchantId: string;
  cartId: string | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
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
  items: OrderItemDto[];
  reservations: InventoryReservationDto[];
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
