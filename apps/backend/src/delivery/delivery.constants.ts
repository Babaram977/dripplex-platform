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
export const DEFAULT_SPEED_MPS = 8.33;
export const MIN_DELIVERY_FEE = 500;
export const FEE_PER_KM = 150;
