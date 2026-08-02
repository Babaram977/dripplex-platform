import type {
  FulfillmentType,
  InventoryReservation,
  Order,
  OrderCancelledBy,
  OrderDispute,
  OrderDisputeStatus,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export type OrderWithItems = Order & {
  items: OrderItem[];
  reservations?: InventoryReservation[];
  disputes?: OrderDispute[];
};

/** A single flexible transition method backs every OrderStatus change —
 * accept/ready/deliver/cancel/refund/etc all set `status` plus whichever
 * milestone timestamp applies, rather than one repository method per
 * transition. */
export interface OrderTransitionInput {
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  estimatedReadyAt?: Date | null;
  confirmedAt?: Date;
  readyAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: OrderCancelledBy;
  cancellationReason?: string;
  refundedAt?: Date;
}

export interface CreateDisputeInput {
  orderId: string;
  raisedBy: string;
  reason: string;
}

export interface ResolveDisputeInput {
  status: OrderDisputeStatus;
  resolution: string;
  resolvedBy: string;
}

export interface CreateOrderInput {
  customerId: string;
  merchantId: string;
  cartId: string;
  orderNumber: string;
  fulfillmentType: FulfillmentType;
  subtotal: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  tax: Prisma.Decimal | number | string;
  deliveryFee: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  currency: string;
  couponCode?: string | null;
  deliveryAddressId?: string | null;
  notes?: string | null;
  items: {
    productId: string;
    variantId?: string | null;
    merchantId: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number | string;
    subtotal: Prisma.Decimal | number | string;
    snapshotName: string;
    snapshotImage?: string | null;
    snapshotSku?: string | null;
  }[];
}

export interface CreateReservationInput {
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  expiresAt: Date;
}

export interface ListOrdersFilter {
  customerId?: string;
  merchantId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  createdFrom?: Date;
  createdTo?: Date;
  skip: number;
  take: number;
}

export interface OrdersRepository {
  create(input: CreateOrderInput): Promise<OrderWithItems>;
  findById(id: string): Promise<OrderWithItems | null>;
  findByIdForCustomer(id: string, customerId: string): Promise<OrderWithItems | null>;
  findByIdForMerchant(id: string, merchantId: string): Promise<OrderWithItems | null>;
  list(filter: ListOrdersFilter): Promise<{ items: OrderWithItems[]; total: number }>;
  transition(id: string, input: OrderTransitionInput): Promise<Order>;
  findByCartId(cartId: string): Promise<Order | null>;
  createReservations(inputs: CreateReservationInput[]): Promise<InventoryReservation[]>;
  releaseReservationsForOrder(orderId: string): Promise<number>;
  findExpiredActiveReservations(now: Date): Promise<InventoryReservation[]>;
  findUnpaidOrdersWithExpiredReservations(now: Date): Promise<OrderWithItems[]>;
  findAutoCompletableOrders(before: Date): Promise<OrderWithItems[]>;
  createDispute(input: CreateDisputeInput): Promise<OrderDispute>;
  findDisputeById(id: string): Promise<OrderDispute | null>;
  findOpenDisputeForOrder(orderId: string): Promise<OrderDispute | null>;
  resolveDispute(id: string, input: ResolveDisputeInput): Promise<OrderDispute>;
}

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');
