import { OrderStatus } from '@prisma/client';

/**
 * The string vocabulary for POS order status synchronisation (MKT-INT-001-L).
 *
 * Kept out of `catalogue-ingestion.constants.ts`, which states in its own first
 * line that it is the catalogue vocabulary. `IntegrationConflict.conflictType`
 * is the one exception and stays there: conflict types must have exactly one
 * home or two modules will spell the same conflict two ways.
 */

/** The scope an incoming credential must carry to move an order's status. */
export const ORDERS_WRITE_SCOPE = 'orders:write';

/** The scope an incoming credential must carry to read orders. */
export const ORDERS_READ_SCOPE = 'orders:read';

/**
 * `OrderStatusUpdate.reconciliationStatus`, exactly as the schema's own doc
 * comment documents it.
 */
export const ORDER_RECONCILIATION_STATUS = {
  /** Recorded, not yet applied. */
  PENDING: 'PENDING',
  /** Matched to a DrippleX order and applied. */
  ACCEPTED: 'ACCEPTED',
  /** Matched, but the order's status did not allow the requested transition. */
  CONFLICT: 'CONFLICT',
} as const;

/**
 * The only two transitions a POS may drive, and the merchant action each one
 * is.
 *
 * The backlog's ticket L named a state machine DrippleX does not have —
 * `RECEIVED → ACCEPTED → PREPARING → READY`, against an `OrderStatus` enum
 * whose members are `DRAFT PENDING CONFIRMED PREPARING READY DRIVER_ASSIGNED
 * PICKED_UP IN_TRANSIT DELIVERED COMPLETED CANCELLED REFUNDED DISPUTED`. There
 * is no `RECEIVED` and no `ACCEPTED`: accepting an order *is* the transition
 * `CONFIRMED → PREPARING`. The vocabulary the schema already established wins,
 * exactly as it did in catalogue contract amendment 1.
 *
 * Everything else is DrippleX-only and stays that way. `CANCELLED` in
 * particular refunds the customer's wallet inside `MerchantOrdersService`, so a
 * POS being able to request it would be a POS being able to move money.
 */
export const POS_DRIVABLE_ORDER_STATUS = {
  /** `MerchantOrdersService.acceptOrder` — requires the order to be CONFIRMED. */
  PREPARING: OrderStatus.PREPARING,
  /** `MerchantOrdersService.markReady` — requires the order to be PREPARING. */
  READY: OrderStatus.READY,
} as const;

export type PosDrivableOrderStatus =
  (typeof POS_DRIVABLE_ORDER_STATUS)[keyof typeof POS_DRIVABLE_ORDER_STATUS];

/** The list class-validator checks the request body against. */
export const POS_DRIVABLE_ORDER_STATUSES: readonly PosDrivableOrderStatus[] =
  Object.values(POS_DRIVABLE_ORDER_STATUS);

/** Audit action recorded for one POS-driven order transition. */
export const ORDER_SYNC_AUDIT_ACTIONS = {
  STATUS_APPLIED: 'integration.order.status.applied',
} as const;

/**
 * How many orders one page of the POS-facing list returns.
 *
 * A POS polls this; an unbounded list would hand a third party a merchant's
 * whole order history in one request.
 */
export const MAX_POS_ORDER_PAGE_SIZE = 50;
