import { RideStatus, RideType } from '@prisma/client';

/**
 * DPX-REVIEWS-001 — fixed preset tags a customer can attach when rating a
 * driver. Backend source of truth for validation; the UI-facing copy is the
 * shared `DRIVER_RATING_TAGS` in `@dripplex/types` (kept identical).
 */
export const DRIVER_RATING_TAGS: readonly string[] = [
  'Safe driving',
  'Clean vehicle',
  'Polite',
  'On time',
  'Great conversation',
  'Helped with bags',
];

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
  /// Pricing-console edits. A fare change is a commercial act, so who changed
  /// what, from what to what, is recorded the same way a refund is.
  FARE_RATE_UPDATED: 'ride.fare_rate_updated',
  SURCHARGE_ZONE_CREATED: 'ride.surcharge_zone_created',
  SURCHARGE_ZONE_UPDATED: 'ride.surcharge_zone_updated',
} as const;

export const RIDE_PERMISSIONS = {
  MANAGE: 'customer:ride:manage',
  DRIVER_MANAGE: 'driver:ride:manage',
  ADMIN_SUPPORT: 'admin:rides:support',
  /// Editing what a ride costs is separate from supporting a ride. An operator
  /// who can refund a trip should not thereby be able to reprice the platform.
  ADMIN_PRICING: 'admin:rides:pricing:manage',
} as const;

/**
 * The platform commission rate is no longer a hard-coded constant. The
 * founder-locked launch rate is 10% and is Ops-configurable at runtime — see
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

/**
 * How long a driver has to respond to an offer before it is reassigned.
 *
 * Fifteen seconds was not survivable in practice. The driver app discovers a
 * pending offer by polling every RIDE_LOCATION_THROTTLE_MS (5s), so up to a
 * third of the window was gone before the card appeared — leaving ~10 seconds
 * to read a fare, a distance and a pickup address and tap Accept, on a phone,
 * while possibly driving. On 2026-08-19 a driver got a real offer and it
 * expired under him.
 *
 * A minute leaves a working window even after the worst-case polling delay.
 */
export const RIDE_OFFER_TIMEOUT_MS = 60_000;

/**
 * How many offers a single ride will ever generate.
 *
 * This is a runaway guard, not a policy. RIDE_SEARCH_WINDOW_MS is what ends a
 * search; a ride that stops being offered while the passenger is still waiting
 * is the bug this used to cause, at five offers of fifteen seconds — seventy-
 * five seconds of trying against a thirty-minute wait.
 *
 * An offer with nobody to rotate to is now renewed rather than re-created
 * (see expireStaleOffers), so a one-driver fleet generates one offer row and
 * holds it, not one per minute. Sixty is far above anything the window can
 * legitimately produce and exists only so a defect cannot mint rows forever.
 */
export const MAX_DISPATCH_ATTEMPTS = 60;

/**
 * How long a ride keeps looking before dispatch stops on its own.
 *
 * Founder decision, 2026-08-19: a request must not close itself and tell the
 * passenger DrippleX could not arrange their ride. That is the same mistake as
 * the "no driver nearby" label removed from the fare screen — it hands the
 * passenger to a competitor at the moment they are ready to travel. A request
 * keeps looking, and the passenger decides when to stop by cancelling.
 *
 * So this is a backstop against unbounded SEARCHING rows, not a moment the
 * passenger is meant to reach. Thirty minutes is far longer than any real
 * wait; a passenger who is still there has cancelled long before, and one who
 * closed the app leaves a row the sweep should eventually stop re-dispatching.
 *
 * Dispatch used to be a single shot: `dispatchRide` ran once inside the
 * booking request, and if nobody was eligible in that instant the ride was
 * marked NO_DRIVERS_FOUND immediately and never looked again. On 2026-08-19 a
 * passenger booked at 03:45:53 and the first driver came online at 03:46:13 —
 * twenty seconds later. That is the normal shape of a thin fleet: the driver
 * opens the app *because* demand exists.
 */
export const RIDE_SEARCH_WINDOW_MS = 30 * 60_000;

/** How often the background sweep checks for expired offers. */
export const RIDE_OFFER_SWEEP_INTERVAL_MS = 5_000;

/** Matches delivery's TRACKING_THROTTLE_MS — reused, not reinvented. */
export const RIDE_LOCATION_THROTTLE_MS = 5_000;

/**
 * Founder decision, 2026-08-18: dispatch searches in expanding rings rather
 * than over the whole platform.
 *
 * Before this, `findNearestEligibleDriver` had no distance filter at all — it
 * ranked every online, accepting, approved driver of the right vehicle type
 * anywhere in the database and offered the ride to the closest. Nearest-first
 * was correct; unbounded was not. With two cities live, a Lagos driver was a
 * valid candidate for a Kano pickup.
 *
 * Dispatch now tries the nearest un-offered driver inside 5km, and only widens
 * when that ring is exhausted — so a passenger is matched to somebody close
 * whenever somebody close exists, and the wider rings are a fallback for a
 * thin fleet rather than the normal path.
 *
 * The customer-facing map already defaults to 5,000m and the Ops Console
 * dispatch-candidates view bounds at 10,000m; these bands are the same order,
 * with 15km as the outer limit.
 */
export const RIDE_DISPATCH_RADIUS_BANDS_METERS: readonly number[] = [5_000, 10_000, 15_000];

/**
 * The widest ring dispatch will ever reach. Exported so the customer-facing
 * availability check asks the same question dispatch will — if these two ever
 * disagree, the fare screen promises a driver dispatch will not look for, or
 * hides one it would have found.
 *
 * Derived with Math.max rather than by index so reordering or adding a band
 * cannot silently leave this pointing at the wrong ring.
 */
export const RIDE_DISPATCH_MAX_RADIUS_METERS = Math.max(...RIDE_DISPATCH_RADIUS_BANDS_METERS);

/**
 * How old a driver's last location ping may be before dispatch stops treating
 * it as where they are.
 *
 * Derived from RIDE_LOCATION_THROTTLE_MS, not a business decision: an online
 * driver's app pushes `driver:location` at most every 5 seconds, so a gap of
 * five minutes is sixty missed pings — the connection is gone, not slow.
 * Without this, a driver who went online in the morning and drove home kept
 * advertising their morning coordinates and stayed the "nearest" candidate
 * forever, taking an offer they could never reach.
 */
export const DRIVER_LOCATION_MAX_AGE_MS = 5 * 60_000;

/** Statuses a ride can still be cancelled from — once IN_PROGRESS or later, it's too late. */
export const CANCELLABLE_RIDE_STATUSES: readonly string[] = [
  'REQUESTED',
  'SEARCHING',
  'DRIVER_ASSIGNED',
  'ARRIVED',
];

/**
 * What Operations may cancel — everything the passenger may cancel, plus
 * IN_PROGRESS.
 *
 * IN_PROGRESS is the state a ride actually strands in: the driver's phone dies
 * mid-trip, nobody completes the trip, and the row holds that driver's
 * `activeRideCount` at 1 so dispatch never offers them another ride again.
 * Neither party can clear it — the customer's cancel button is gone by then and
 * the driver's app is what failed.
 *
 * The consequence is deliberate and one-way: settlement only ever runs on
 * COMPLETE (RideTripService.completeTrip → RidePaymentService), so cancelling
 * an IN_PROGRESS ride charges the passenger nothing and pays the driver
 * nothing. That is why the operator's reason is mandatory and why the
 * cancellation is attributed to OPERATIONS rather than SYSTEM.
 */
export const OPERATIONS_CANCELLABLE_RIDE_STATUSES: readonly string[] = [
  ...CANCELLABLE_RIDE_STATUSES,
  'IN_PROGRESS',
];

/** Statuses that count as "the driver currently has a trip in progress" —
 * used to recover the active ride reference after a page refresh. */
export const ACTIVE_DRIVER_RIDE_STATUSES: RideStatus[] = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

/** Statuses a passenger can mint a "share my trip" link for. Deliberately
 * includes REQUESTED and SEARCHING: telling someone you are on your way is
 * most useful before a driver has even been found. */
export const SHAREABLE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.SEARCHING,
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

/** How long a share link keeps answering after the trip ends. Long enough for
 * the person watching to see it arrive, short enough that a forwarded link is
 * not a permanent window into someone's movements. */
export const SHARE_LINK_GRACE_MS = 30 * 60_000;

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
/**
 * Founder decision, 2026-08-16: "make the minimum trip charge per trip order to
 * be 1500, that is a distance of less than a km."
 *
 * A floor under the computed fare, applied to every ride type. A short hop that
 * prices out below this is charged this instead, so a sub-kilometre trip is
 * still worth a driver's time. Applied AFTER base + distance + time, so longer
 * trips are unaffected.
 */
export const RIDE_MINIMUM_FARE = 1500;

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
