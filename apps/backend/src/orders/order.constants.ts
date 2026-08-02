export const ORDER_AUDIT_ACTIONS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  ACCEPTED: 'order.accepted',
  REJECTED: 'order.rejected',
  READY: 'order.ready',
  DELAYED: 'order.delayed',
  COMPLETED: 'order.completed',
  REFUNDED: 'order.refunded',
  DISPUTE_RAISED: 'order.dispute_raised',
  DISPUTE_RESOLVED: 'order.dispute_resolved',
} as const;

export const ORDER_PERMISSIONS = {
  CHECKOUT: 'customer:checkout',
  ORDERS: 'customer:orders',
  ADMIN_READ: 'admin:orders:read',
  ADMIN_MANAGE: 'admin:orders:manage',
  MERCHANT_MANAGE: 'merchant:orders:manage',
} as const;

export const RESERVATION_TTL_MS = 30 * 60 * 1000;
export const RESERVATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** How long a DELIVERED/COMPLETED-eligible order waits for the customer to
 * either confirm receipt or raise a dispute before the sweep auto-completes
 * it. Mirrors the reservation-cleanup sweep pattern. */
export const ORDER_AUTO_COMPLETE_AFTER_MS = 24 * 60 * 60 * 1000;
export const ORDER_COMPLETION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** WalletLedgerEntry.referenceType for order refunds, paired with
 * referenceId = order.id — same idempotency pattern as
 * RIDE_WALLET_REFERENCE_TYPES / PROMOTION_WALLET_REFERENCE_TYPE. */
export const ORDER_WALLET_REFERENCE_TYPE = 'order_refund';
