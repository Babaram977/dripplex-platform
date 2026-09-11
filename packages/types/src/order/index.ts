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
export type OrderPaymentMethod =
  'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY' | 'WALLET' | 'CASH' | 'MERCHANT_DIRECT';

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

/**
 * DPX-ORDER-PROOF-001 — the customer's receipt for a MERCHANT_DIRECT bank
 * transfer, shown to the merchant before they confirm receipt and referenced
 * if the order is later disputed.
 *
 * `receiptUrl` is a short-lived SIGNED GET url minted per read, not a durable
 * link — receipts live in the private bucket. Do not cache or persist it.
 */
export interface OrderPaymentProofDto {
  id: string;
  orderId: string;
  submittedBy: string;
  receiptUrl: string;
  reference: string | null;
  /** What the customer says they transferred; may differ from order.total. */
  amount: number | null;
  note: string | null;
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

/// Customer-facing view of the merchant's payout bank account for an order the
/// customer owns — exposed at `GET /customer/orders/:id/merchant-bank` so the
/// "Pay to Merchant Bank" (MERCHANT_DIRECT) checkout option can show where to
/// transfer. Deliberately minimal and read-only: no isDefault/verifiedAt or
/// internal ids are leaked. accountNumber IS included — the customer needs it
/// to make the transfer.
export interface CustomerMerchantBankDto {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
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

/// DPX-MERCHANT-001 Phase 1 — mirrors `MerchantOrdersController`
/// (`apps/backend/src/orders/merchant-orders.controller.ts`) 1:1. These
/// requests act on the same Universal Order State Machine as the customer
/// and admin surfaces above; only the merchant-scoped actions differ.
export interface MerchantOrderListQuery extends ListOrdersQuery {
  status?: OrderStatus;
}

export interface AcceptOrderRequest {
  estimatedReadyAt?: string;
}

export interface RejectOrderRequest {
  reason: string;
}

export interface DelayOrderRequest {
  estimatedReadyAt: string;
  reason?: string;
}

export interface MerchantCancelOrderRequest {
  reason?: string;
}

/// DPX-MERCHANT-002 — Marketplace Merchant Settlement. See
/// docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md.
export type OrderSettlementStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface OrderSettlementDto {
  id: string;
  orderId: string;
  /// The human-readable order number (Order.orderNumber), joined in for
  /// merchant-facing settlement views so a merchant never has to look up
  /// a raw order UUID to know which sale a settlement corresponds to.
  orderNumber: string;
  merchantId: string;
  status: OrderSettlementStatus;
  grossAmount: number;
  /** What was actually charged, snapshotted at settlement. Never recomputed. */
  commissionRate: number;
  /** The campaign that set `commissionRate`, or null when the standing rate
   *  did. */
  commissionCampaignId: string | null;
  /** The merchant's negotiated rate as it stood when this settled, or null if
   *  they had no agreement then (DPX-MERCHANT-016).
   *
   *  Together with the two above, the charge is explicable from the row alone:
   *  a campaign id names the override, this names the standing agreement, and
   *  both null means the platform rate applied and `commissionRate` is it. */
  negotiatedRate: number | null;
  commissionAmount: number;
  merchantAmount: number;
  currency: string;
  walletLedgerEntryId: string | null;
  failureReason: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  reversalLedgerEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantCommissionSettingDto {
  id: string;
  commissionRate: number;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface UpdateMerchantCommissionSettingsRequest {
  commissionRate: number;
}

/** The agreement itself, as Operations sets and reads it. */
export interface MerchantNegotiatedRateDto {
  merchantProfileId: string;
  /** Fraction, or null when no agreement exists. */
  negotiatedRate: number | null;
  negotiatedBy: string | null;
  negotiatedAt: string | null;
  negotiationNote: string | null;
}

export interface SetMerchantNegotiatedRateRequest {
  /** Null clears the agreement and returns the merchant to the platform rate. */
  rate: number | null;
  note?: string;
}

/**
 * What DrippleX charges one merchant, as that merchant is shown it.
 *
 * Distinct from `MerchantCommissionSettingDto`, which is the Ops-facing
 * singleton: this is the rate resolved *for a named merchant*, so a commission
 * campaign aimed at them is already applied.
 */
export interface MerchantCommissionTermsDto {
  /** The rate in force for this merchant, as a fraction (0.10 = 10%). */
  commissionRate: number;
  /** Their share of an order, `1 - commissionRate`. Returned rather than left
   *  to the client so every surface subtracts it the same way. */
  merchantShareRate: number;
  /** The rate that applies when no campaign is running: this merchant's
   *  negotiated rate if they have one, the platform rate otherwise. Equal to
   *  `commissionRate` when nothing special is running. */
  standingRate: number;
  /** A rate agreed with this merchant individually, or null when none has
   *  been. Reported beside `platformRate` so an agreed rate is legible as an
   *  agreement rather than as an unexplained number. */
  negotiatedRate: number | null;
  /** The platform-wide default, before any agreement or campaign. */
  platformRate: number;
  /** The commission campaign currently overriding the standing rate, if any. */
  campaignId: string | null;
  campaignName: string | null;
}

export const ORDER_AUDIT_ACTIONS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
} as const;

export type OrderAuditAction = (typeof ORDER_AUDIT_ACTIONS)[keyof typeof ORDER_AUDIT_ACTIONS];
