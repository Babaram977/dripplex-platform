import type {
  CheckoutResponseDto,
  InventoryReservationDto,
  MerchantCommissionSettingDto,
  OrderDisputeDto,
  OrderDto,
  OrderItemDto,
  OrderSettlementDto,
  PaginatedResult,
} from '@dripplex/types';
import type {
  InventoryReservation,
  MerchantCommissionSetting,
  Order,
  OrderDispute,
  OrderItem,
  OrderSettlement,
} from '@prisma/client';

export type OrderWithRelations = Order & {
  items: OrderItem[];
  reservations?: InventoryReservation[];
  disputes?: OrderDispute[];
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toOrderItemDto(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    variantId: item.variantId,
    merchantId: item.merchantId,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    subtotal: Number(item.subtotal),
    snapshotName: item.snapshotName,
    snapshotImage: item.snapshotImage,
    snapshotSku: item.snapshotSku,
    createdAt: item.createdAt.toISOString(),
  };
}

export function toInventoryReservationDto(
  reservation: InventoryReservation,
): InventoryReservationDto {
  return {
    id: reservation.id,
    orderId: reservation.orderId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    quantity: reservation.quantity,
    expiresAt: reservation.expiresAt.toISOString(),
    releasedAt: reservation.releasedAt ? reservation.releasedAt.toISOString() : null,
    createdAt: reservation.createdAt.toISOString(),
  };
}

export function toOrderDisputeDto(dispute: OrderDispute): OrderDisputeDto {
  return {
    id: dispute.id,
    orderId: dispute.orderId,
    raisedBy: dispute.raisedBy,
    reason: dispute.reason,
    status: dispute.status,
    resolution: dispute.resolution,
    resolvedBy: dispute.resolvedBy,
    createdAt: dispute.createdAt.toISOString(),
    resolvedAt: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
  };
}

export function toOrderDto(order: OrderWithRelations): OrderDto {
  return {
    id: order.id,
    customerId: order.customerId,
    merchantId: order.merchantId,
    cartId: order.cartId,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    fulfillmentType: order.fulfillmentType,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    couponCode: order.couponCode,
    deliveryAddressId: order.deliveryAddressId,
    notes: order.notes,
    currency: order.currency,
    estimatedReadyAt: order.estimatedReadyAt ? order.estimatedReadyAt.toISOString() : null,
    confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
    readyAt: order.readyAt ? order.readyAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    cancelledBy: order.cancelledBy,
    cancellationReason: order.cancellationReason,
    refundedAt: order.refundedAt ? order.refundedAt.toISOString() : null,
    items: order.items.map(toOrderItemDto),
    reservations: (order.reservations ?? []).map(toInventoryReservationDto),
    disputes: (order.disputes ?? []).map(toOrderDisputeDto),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toCheckoutResponseDto(order: OrderWithRelations): CheckoutResponseDto {
  return {
    order: toOrderDto(order),
  };
}

export function toPaginatedOrders(
  items: OrderWithRelations[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<OrderDto> {
  return {
    items: items.map(toOrderDto),
    meta: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function generateOrderNumber(now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DPX-${String(yyyy)}${mm}${dd}-${suffix}`;
}

/// DPX-MERCHANT-002. `orderNumber` is joined in separately (the caller
/// selects `order: { orderNumber: true }`) rather than widened onto the
/// bare `OrderSettlement` type, since most call sites don't need it.
export function toOrderSettlementDto(
  settlement: OrderSettlement,
  orderNumber: string,
): OrderSettlementDto {
  return {
    id: settlement.id,
    orderId: settlement.orderId,
    orderNumber,
    merchantId: settlement.merchantId,
    status: settlement.status,
    grossAmount: Number(settlement.grossAmount),
    commissionRate: Number(settlement.commissionRate),
    commissionAmount: Number(settlement.commissionAmount),
    merchantAmount: Number(settlement.merchantAmount),
    currency: settlement.currency,
    walletLedgerEntryId: settlement.walletLedgerEntryId,
    failureReason: settlement.failureReason,
    reversedAt: settlement.reversedAt?.toISOString() ?? null,
    reversalReason: settlement.reversalReason,
    reversalLedgerEntryId: settlement.reversalLedgerEntryId,
    createdAt: settlement.createdAt.toISOString(),
    updatedAt: settlement.updatedAt.toISOString(),
  };
}

export function toMerchantCommissionSettingDto(
  setting: MerchantCommissionSetting,
): MerchantCommissionSettingDto {
  return {
    id: setting.id,
    commissionRate: Number(setting.commissionRate),
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt.toISOString(),
    createdAt: setting.createdAt.toISOString(),
  };
}
