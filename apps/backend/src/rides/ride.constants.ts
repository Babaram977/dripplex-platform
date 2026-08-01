import { RideType } from '@prisma/client';

export const RIDE_AUDIT_ACTIONS = {
  REQUESTED: 'ride.requested',
  CANCELLED: 'ride.cancelled',
} as const;

export const RIDE_PERMISSIONS = {
  MANAGE: 'customer:ride:manage',
} as const;

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
