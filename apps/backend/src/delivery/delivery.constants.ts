export const DELIVERY_AUDIT_ACTIONS = {
  ASSIGNED: 'delivery.assigned',
  ACCEPTED: 'delivery.accepted',
  PICKED_UP: 'delivery.picked_up',
  ARRIVED: 'delivery.arrived',
  COMPLETED: 'delivery.completed',
  CANCELLED: 'delivery.cancelled',
  RETURNED: 'delivery.returned',
  FAILED: 'delivery.failed',
  LOCATION_UPDATED: 'delivery.location_updated',
  REJECTED: 'delivery.rejected',
  /// DPX-COMMERCIAL-001 Slice 3 — the rider's cash-collection confirmation.
  CASH_CONFIRMED: 'delivery.cash_confirmed',
} as const;

export const DELIVERY_PERMISSIONS = {
  CUSTOMER_READ: 'customer:delivery:read',
  RIDER_MANAGE: 'rider:delivery:manage',
  ADMIN_MANAGE: 'admin:delivery:manage',
} as const;

export const TRACKING_THROTTLE_MS = 5000;
export const MAX_RIDER_ACTIVE_JOBS = 3;

/**
 * DPX-RIDER-004 — how often unassigned deliveries are re-dispatched.
 *
 * Auto-assignment previously ran exactly once, when the merchant marked the
 * order ready. If no eligible rider was online and located at that instant the
 * job sat PENDING with no rider forever, and a rider coming online a minute
 * later was never considered. Same plain-setInterval sweep pattern as
 * RideOfferSweepService / ReservationCleanupService (no @nestjs/schedule
 * dependency in this codebase).
 */
export const DELIVERY_DISPATCH_SWEEP_INTERVAL_MS = 30_000;

/**
 * Most unassigned jobs re-dispatched per sweep. A bound keeps one sweep's work
 * predictable; anything left over is picked up by the next tick.
 */
export const DELIVERY_DISPATCH_SWEEP_BATCH_SIZE = 25;

/**
 * How long a rider who turned a job down stays out of the running for it.
 *
 * Rejections used to exclude a rider from that job forever. In a thin fleet
 * that is the same as cancelling the delivery: with one rider online, a single
 * decline left the job PENDING, and the 30-second sweep then re-ran forever,
 * excluding the only person who could take it and logging nothing because it
 * only logs when it assigns. Two real orders reached that state — one already
 * paid for — and neither was visible to Ops.
 *
 * A decline still means "not right now": the rider is not re-offered the same
 * job on the very next tick. After the window they are eligible again, which
 * is the same bet the ride side makes with its offer expiry.
 */
export const DELIVERY_REJECTION_COOLDOWN_MS = 10 * 60_000;
export const DEFAULT_SPEED_MPS = 8.33;
export const MIN_DELIVERY_FEE = 500;
export const FEE_PER_KM = 150;
