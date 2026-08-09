import { RideStatus, RideType } from '@prisma/client';

export const RIDE_AUDIT_ACTIONS = {
  REQUESTED: 'ride.requested',
  CANCELLED: 'ride.cancelled',
  OFFERED: 'ride.offered',
  OFFER_ACCEPTED: 'ride.offer_accepted',
  OFFER_DECLINED: 'ride.offer_declined',
  OFFER_EXPIRED: 'ride.offer_expired',
  NO_DRIVERS_FOUND: 'ride.no_drivers_found',
  ARRIVED: 'ride.arrived',
  STARTED: 'ride.started',
  COMPLETED: 'ride.completed',
  PAYMENT_INITIATED: 'ride.payment_initiated',
  PAYMENT_SUCCEEDED: 'ride.payment_succeeded',
  PAYMENT_FAILED: 'ride.payment_failed',
  CASH_CONFIRMED: 'ride.cash_confirmed',
  RATED: 'ride.rated',
  TIP_ADDED: 'ride.tip_added',
  PROBLEM_REPORTED: 'ride.problem_reported',
  PROBLEM_RESOLVED: 'ride.problem_resolved',
  REFUNDED: 'ride.refunded',
} as const;

export const RIDE_PERMISSIONS = {
  MANAGE: 'customer:ride:manage',
  DRIVER_MANAGE: 'driver:ride:manage',
  ADMIN_SUPPORT: 'admin:rides:support',
} as const;

/**
 * The platform commission rate is no longer a hard-coded constant. The
 * founder-locked launch rate is 15% and is Ops-configurable at runtime — see
 * `PlatformCommissionSettingsService` (seeded from
 * `DEFAULT_PLATFORM_COMMISSION_RATE` in commercial.constants.ts). Ride
 * settlement reads the active rate and snapshots it onto each ride, so a later
 * rate change never rewrites an already-settled ride.
 */

/**
 * WalletLedgerEntry.referenceType values used for ride settlement.
 * Both are paired with referenceId = ride.id, which is what makes each
 * wallet mutation idempotent (WalletService.applyMutation skips a mutation
 * that already has a ledger entry for the same walletId+referenceType+
 * referenceId) — safe to retry a whole settlement without double-crediting.
 */
export const RIDE_WALLET_REFERENCE_TYPES = {
  FARE: 'ride_fare',
  EARNING: 'ride_earning',
  TIP: 'ride_tip',
  /// DPX-D4 — refund legs, each paired with referenceId = ride.id so they are
  /// idempotent exactly like the settlement legs above. REFUND is the
  /// customer credit-back + the platform release of the captured fare;
  /// EARNING_REVERSAL is the driver-earning clawback debit + the matching
  /// platform credit. Distinct from FARE/EARNING so a refund's ledger entries
  /// never collide with the original settlement's on the same wallet.
  REFUND: 'ride_refund',
  EARNING_REVERSAL: 'ride_earning_reversal',
} as const;

/** PromotionRedemption.referenceType for a ride fare coupon redemption,
 * paired with referenceId = ride.id — mirrors the marketplace order flow's
 * hard-coded 'order' referenceType, just for the Ride domain instead. */
export const RIDE_PROMOTION_REFERENCE_TYPE = 'ride';

/** How long a driver has to respond to an offer before it's reassigned. */
export const RIDE_OFFER_TIMEOUT_MS = 15_000;

/** Give up and mark a ride NO_DRIVERS_FOUND after this many declined/expired offers. */
export const MAX_DISPATCH_ATTEMPTS = 5;

/** How often the background sweep checks for expired offers. */
export const RIDE_OFFER_SWEEP_INTERVAL_MS = 5_000;

/** Matches delivery's TRACKING_THROTTLE_MS — reused, not reinvented. */
export const RIDE_LOCATION_THROTTLE_MS = 5_000;

/** Statuses a ride can still be cancelled from — once IN_PROGRESS or later, it's too late. */
export const CANCELLABLE_RIDE_STATUSES: readonly string[] = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'ARRIVED',
];

/** Statuses that count as "the driver currently has a trip in progress" —
 * used to recover the active ride reference after a page refresh. */
export const ACTIVE_DRIVER_RIDE_STATUSES: RideStatus[] = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

export const DEFAULT_RIDE_SPEED_MPS = 8.33;

/**
 * Founder-locked decision (no mandatory passenger OTP/PIN before ride start):
 * a driver may only tap "Start Ride" when their last-known location is
 * within this distance of the pickup point. Founder specified 30-50m; 50m
 * chosen as the more lenient end of that explicit range, not a placeholder
 * awaiting approval like RIDE_FARE_RATES below.
 */
export const RIDE_START_PROXIMITY_METERS = 50;

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
  [RideType.COMFORT]: { baseFare: 450, perKmRate: 160, perMinuteRate: 25 },
  [RideType.XL]: { baseFare: 600, perKmRate: 200, perMinuteRate: 30 },
  [RideType.TRICYCLE]: { baseFare: 150, perKmRate: 80, perMinuteRate: 10 },
};

/**
 * Single source of truth for ride-type display copy — founder direction
 * (launch with exactly three customer-facing categories: Dx Ride/Dx
 * Comfort/Dx XL) plus the existing TRICYCLE vehicle class, unchanged.
 * Brand casing is "Dx" (capital D, lowercase x), not "DX". Tricycle is
 * not Dx-branded — it stays "Tricycle".
 * The backend owns this so the frontend never hardcodes a service name
 * (the defect this replaces: `Record<string,string>` label maps duplicated
 * across the Fare Estimate, History, and Trip Completed screens).
 */
export const RIDE_TYPE_CATALOG: Record<
  RideType,
  { displayName: string; description: string; emoji: string }
> = {
  [RideType.ECONOMY]: {
    displayName: 'Dx Ride',
    description: 'Everyday affordable rides',
    emoji: '🚗',
  },
  [RideType.COMFORT]: {
    displayName: 'Dx Comfort',
    description: 'Newer vehicles, more legroom, better-rated drivers',
    emoji: '🚙',
  },
  [RideType.XL]: {
    displayName: 'Dx XL',
    description: 'Larger vehicle for families and groups (5-7 seats)',
    emoji: '🚐',
  },
  [RideType.TRICYCLE]: {
    displayName: 'Tricycle',
    description: 'Quick, affordable short trips',
    emoji: '🛺',
  },
};
