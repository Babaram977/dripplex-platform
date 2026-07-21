import type {
  FulfillmentType,
  InventoryReservation,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export type OrderWithItems = Order & {
  items: OrderItem[];
  reservations?: InventoryReservation[];
};

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
  list(filter: ListOrdersFilter): Promise<{ items: OrderWithItems[]; total: number }>;
  cancelOrder(id: string): Promise<Order>;
  markFailed(id: string): Promise<Order>;
  markPaid(id: string): Promise<Order>;
  findByCartId(cartId: string): Promise<Order | null>;
  createReservations(inputs: CreateReservationInput[]): Promise<InventoryReservation[]>;
  releaseReservationsForOrder(orderId: string): Promise<number>;
  findExpiredActiveReservations(now: Date): Promise<InventoryReservation[]>;
  findUnpaidOrdersWithExpiredReservations(now: Date): Promise<OrderWithItems[]>;
}

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');
