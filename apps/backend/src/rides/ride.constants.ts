import { RideType } from '@prisma/client';

export const RIDE_AUDIT_ACTIONS = {
  REQUESTED: 'ride.requested',
  CANCELLED: 'ride.cancelled',
  OFFERED: 'ride.offered',
  OFFER_ACCEPTED: 'ride.offer_accepted',
  OFFER_DECLINED: 'ride.offer_declined',
  OFFER_EXPIRED: 'ride.offer_expired',
  NO_DRIVERS_FOUND: 'ride.no_drivers_found',
} as const;

export const RIDE_PERMISSIONS = {
  MANAGE: 'customer:ride:manage',
  DRIVER_MANAGE: 'driver:ride:manage',
} as const;

/** How long a driver has to respond to an offer before it's reassigned. */
export const RIDE_OFFER_TIMEOUT_MS = 15_000;

/** Give up and mark a ride NO_DRIVERS_FOUND after this many declined/expired offers. */
export const MAX_DISPATCH_ATTEMPTS = 5;

/** How often the background sweep checks for expired offers. */
export const RIDE_OFFER_SWEEP_INTERVAL_MS = 5_000;

/** Statuses a ride can still be cancelled from — once IN_PROGRESS or later, it's too late. */
export const CANCELLABLE_RIDE_STATUSES: readonly string[] = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'ARRIVED',
];

export const DEFAULT_RIDE_SPEED_MPS = 8.33;

/**
 * Placeholder fare constants — anchored to delivery's existing per-km pricing
 * magnitude (FEE_PER_KM = 150), not a founder-approved fare table. Real ride
 * economics (base fare, per-km, per-minute, per ride type) need explicit
 * business sign-off before the Kano pilot goes live. Tracked as a follow-up,
 * not blocking RIDE-002.3's ride-request mechanism.
 */
export const RIDE_FARE_RATES: Record<
  RideType,
  { baseFare: number; perKmRate: number; perMinuteRate: number }
> = {
  [RideType.ECONOMY]: { baseFare: 300, perKmRate: 120, perMinuteRate: 20 },
  [RideType.TRICYCLE]: { baseFare: 150, perKmRate: 80, perMinuteRate: 10 },
};
