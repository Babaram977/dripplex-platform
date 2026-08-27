export type RideType = 'ECONOMY' | 'COMFORT' | 'XL' | 'TRICYCLE';

export interface RideTypeCatalogEntryDto {
  type: RideType;
  displayName: string;
  description: string;
  emoji: string;

  /**
   * Whether a driver of this type is currently reachable from the pickup
   * point, and how far the nearest one is.
   *
   * Only present when the caller passes `latitude`/`longitude` to
   * `GET /customer/rides/types`. Without a pickup there is no "in range" to
   * answer, so both fields stay undefined and the UI must not claim either
   * way.
   *
   * `availableNow: false` means dispatch would search all the way out to its
   * widest ring and find nobody — the passenger would wait through every
   * offer attempt and end at NO_DRIVERS_FOUND. Saying so before they book is
   * the whole point of this field.
   */
  availableNow?: boolean;
  /** Straight-line metres to the nearest eligible driver, or null when there
   * is none. Not a road distance and not an ETA — it is what dispatch ranks
   * on, so it is what we can honestly report. */
  nearestDriverMeters?: number | null;

  /**
   * Set when a zone bars this ride type from the pickup point entirely — not
   * "nobody is free right now" but "this vehicle may not go there".
   *
   * Distinct from `availableNow` on purpose: a tricycle at Kano airport is not
   * unavailable, it is not permitted, and a UI that greys it out with "no
   * drivers nearby" tells the passenger to wait for something that will never
   * come. When set, the type cannot be booked from here at all.
   *
   * Only the pickup is known at this point. A restriction that applies to the
   * destination is caught by the fare estimate instead.
   */
  restrictedReason?: string | null;
}

// ── Pricing console ─────────────────────────────────────────────────────────

export type RideSurchargeType = 'FLAT' | 'MULTIPLIER';
export type RideSurchargeTrigger = 'PICKUP' | 'DROPOFF' | 'EITHER';

/** One row of the Ops-editable fare table. Amounts are naira. */
export interface RideFareRateDto {
  rideType: RideType;
  /** "Dx Comfort" — from the same catalog the passenger app reads, so the
   * console and the app can never disagree about a service name. */
  displayName: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  /** A floor under the computed fare, not an addition. */
  minimumFare: number;
}

/** A named circle where trips cost more — the airport being the case that
 * prompted it. A centre and a radius rather than a polygon, so an operator can
 * set one up from a map pin and a distance. */
export interface RideSurchargeZoneDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  surchargeType: RideSurchargeType;
  /** Naira when FLAT, a factor when MULTIPLIER (1.25 = a quarter more). */
  amount: number;
  appliesTo: RideSurchargeTrigger;
  /** Ride types this zone bars outright — empty means none. A ban, not a
   * price: a barred type is refused at the estimate rather than quoted. */
  excludedRideTypes: RideType[];
  active: boolean;
  updatedAt: string;
}

export type RideStatus =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVERS_FOUND';

/**
 * `SYSTEM` is the automatic offer-expiry sweep; `OPERATIONS` is a human on the
 * support desk cancelling a stranded ride from the console. They are kept
 * apart so a cancellation trail says which of the two ended the trip.
 */
export type RideCancelledBy = 'CUSTOMER' | 'DRIVER' | 'SYSTEM' | 'OPERATIONS';

export type RidePaymentMethod = 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY' | 'CASH';
export type RidePaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface RideDto {
  id: string;
  customerId: string;
  driverId: string | null;
  rideType: RideType;
  status: RideStatus;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  /** DPX-PRICING-002 — seconds from `startedAt` to `completedAt`, the duration
   * `timeFare` below was actually charged on. Null until the trip completes,
   * and on any ride quoted before this existed. */
  actualDurationSeconds: number | null;
  /** The total quoted at booking, kept once the fare is recomputed on real
   * elapsed time so a receipt can show quote and charge side by side. Null when
   * the two are the same — i.e. no repricing has happened. */
  quotedTotalFare: number | null;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  /** Naira a surcharge zone added to this trip, and which zone did it. The
   * name is snapshotted so a receipt still reads "Airport" after the zone has
   * been renamed or switched off. Zero and null mean no zone applied. */
  surchargeAmount: number;
  surchargeZoneId: string | null;
  surchargeZoneName: string | null;
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  paymentMethod: RidePaymentMethod | null;
  paymentStatus: RidePaymentStatus;
  platformCommission: number | null;
  driverEarning: number | null;
  tipAmount: number | null;
  requestedAt: string;
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: RideCancelledBy | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A ride as its **driver** sees it, plus the passenger's display name.
 *
 * Name only, no phone number — the same rule as `RiderDeliveryJobDto`, for the
 * same reason: a name lets the driver greet the right person and address a
 * chat thread; a phone number is permanent, leaves the platform, and cannot be
 * taken back. (Founder decision, 2026-08-16.) */
export interface DriverRideDto extends RideDto {
  customerName: string | null;
  /** Whether this ride carries a passenger trip code the driver must enter
   * before starting. False on rides assigned before trip codes existed —
   * those stay startable rather than becoming stuck. */
  requiresVerificationCode: boolean;
}

/** The car the passenger is waiting for. Only ever sent to the passenger:
 * the driver already knows what they are driving. */
export interface RideDriverVehicleDto {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
}

/** A ride as its **customer** sees it, plus the assigned driver's display
 * name — the mirror of `CustomerDeliveryDto.riderName`, so the passenger can
 * see and message a named person rather than a UUID. */
export interface CustomerRideDto extends RideDto {
  driverName: string | null;
  /** The 4-digit code the passenger reads out to the driver at pickup.
   * Generated when a driver accepts; null before that. Never sent to the
   * driver — the whole point is that only the passenger has it. */
  verificationCode: string | null;
  driverVehicle: RideDriverVehicleDto | null;
}

/** What a passenger gets back when they share their trip. The client builds
 * the full URL from its own origin, so a link always points at the host the
 * passenger is actually using. */
export interface RideShareLinkDto {
  token: string;
  /** Path to append to the app's origin, e.g. `/t/9f3c…`. */
  path: string;
}

/**
 * A live trip as the person it was shared with sees it — no login required,
 * the token in the link is the only credential.
 *
 * Deliberately thin: first names only, no phone numbers, no fare, no ride id,
 * and never the trip verification code. Enough to watch a car arrive; not
 * enough to identify or act on anyone.
 */
export interface SharedRideDto {
  status: RideStatus;
  rideType: RideType;
  passengerFirstName: string | null;
  driverFirstName: string | null;
  vehicle: RideDriverVehicleDto | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  /** Last known driver position while the trip is live; null once it ends. */
  driverPosition: { latitude: number; longitude: number; updatedAt: string } | null;
  estimatedDurationSeconds: number | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface StartRideTripRequest {
  /** The passenger's 4-digit trip code, read out at pickup. */
  verificationCode?: string;
}

export interface InitiateRidePaymentRequest {
  method: RidePaymentMethod;
  callbackUrl?: string;
}

export interface InitiateRidePaymentResponse {
  ride: RideDto;
  authorizationUrl?: string;
  reference?: string;
}

export type RideRatingRole = 'CUSTOMER' | 'DRIVER';

export interface RideCategoryRatings {
  driving?: number;
  cleanliness?: number;
  professionalism?: number;
  behaviour?: number;
  waitingTime?: number;
  paymentExperience?: number;
}

export interface RideRatingDto {
  id: string;
  rideId: string;
  raterId: string;
  rateeId: string;
  raterRole: RideRatingRole;
  rating: number;
  comment: string | null;
  /** DPX-REVIEWS-001 — preset tags (customer→driver only). */
  tags: string[];
  categoryRatings: RideCategoryRatings | null;
  createdAt: string;
}

export interface RateRideRequest {
  rating: number;
  comment?: string;
  categoryRatings?: RideCategoryRatings;
  /** DPX-REVIEWS-001 — preset tags (customer→driver only). */
  tags?: string[];
}

export type RideProblemCategory =
  'WRONG_FARE' | 'DRIVER_BEHAVIOUR' | 'UNSAFE_DRIVING' | 'LOST_ITEM' | 'VEHICLE_ISSUE' | 'OTHER';

export type RideProblemStatus = 'OPEN' | 'RESOLVED';

export interface RideProblemReportDto {
  id: string;
  rideId: string;
  reporterId: string;
  category: RideProblemCategory;
  description: string | null;
  status: RideProblemStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReportRideProblemRequest {
  category: RideProblemCategory;
  description?: string;
}

export interface TipDriverRequest {
  amount: number;
}

export interface RideReceiptDriverDto {
  id: string;
  name: string;
  phone: string | null;
  vehicleType: RideType;
}

export interface RideReceiptDto {
  rideId: string;
  status: RideStatus;
  driver: RideReceiptDriverDto | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  distanceMeters: number | null;
  /** How long the trip took: real elapsed time once DPX-PRICING-002 has
   * repriced it, falling back to the booking estimate for rides completed
   * before that. This is the duration `timeFare` was charged on. */
  durationSeconds: number | null;
  /** What the booking assumed it would take, kept beside the real figure so a
   * longer, dearer trip explains itself rather than looking like an error. */
  estimatedDurationSeconds: number | null;
  fare: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    /** Shown as its own line rather than folded into the total — a passenger
     * charged extra for an airport run is entitled to see why. */
    surchargeAmount: number;
    surchargeZoneName: string | null;
    totalFare: number;
    /** The total quoted at booking, when the final charge differs from it.
     * Null when nothing was repriced — there is then only one number and
     * showing it twice invites the question it exists to answer. */
    quotedTotalFare: number | null;
    tipAmount: number | null;
    platformCommission: number | null;
    driverEarning: number | null;
  };
  paymentMethod: RidePaymentMethod | null;
  paymentStatus: RidePaymentStatus;
  requestedAt: string;
  completedAt: string | null;
}

export interface RequestRideRequest {
  rideType: RideType;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress?: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress?: string;
  couponCode?: string;
}

export interface EstimateRideFareRequest {
  rideType: RideType;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  couponCode?: string;
}

export interface EstimateRideFareResponse {
  distanceMeters: number;
  durationSeconds: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  /** Naira added by a surcharge zone, or 0. On the wire since surcharge zones
   * shipped; declared here only now, which is why no client ever showed it. */
  surchargeAmount: number;
  surchargeZoneId: string | null;
  surchargeZoneName: string | null;
  /** base + distance + time. What the itemised lines sum to. */
  meteredFare: number;
  /** The floor under this ride type's price. */
  minimumFare: number;
  /** Whether that floor is what set `totalFare`. */
  minimumFareApplied: boolean;
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  finalFare: number;
}

export interface DriverAvailabilityDto {
  driverId: string;
  online: boolean;
  acceptingRides: boolean;
  /// Whether this driver also takes merchant delivery jobs. Independent of
  /// `acceptingRides` — a driver may want parcels without passengers.
  acceptingDeliveries: boolean;
  vehicleType: RideType;
  latitude: number | null;
  longitude: number | null;
  activeRideCount: number;
  updatedAt: string;
}

export interface UpdateDriverAvailabilityRequest {
  online: boolean;
  /// Omit to leave the stored preference untouched; sending `false` opts out.
  acceptingDeliveries?: boolean;
  acceptingRides: boolean;
  vehicleType: RideType;
  latitude?: number;
  longitude?: number;
  /** Driver-001: used for the "new device" identity-verification risk check. */
  deviceId?: string;
}

export type RideOfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface RideOfferDto {
  id: string;
  rideId: string;
  driverId: string;
  status: RideOfferStatus;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
}

/** What a driver sees before accepting/declining — deliberately excludes
 * customer identity (name/phone), which is only revealed after acceptance
 * via RideDto. */
export interface RideOfferPreviewDto {
  id: string;
  rideId: string;
  status: RideOfferStatus;
  expiresAt: string;
  rideType: RideType;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  totalFare: number;
  paymentMethod: RidePaymentMethod | null;
}

/** Anonymized driver position shown on the pre-booking map — no driverId,
 * coordinates rounded to ~11m for privacy (see RideTrackingReadService). */
export interface NearbyDriverDto {
  latitude: number;
  longitude: number;
  vehicleType: RideType;
}

/** One breadcrumb from the RideTracking trail, written by RideGateway's
 * `driver:location` handler while a ride is active. Used to seed a map's
 * route polyline on load/reconnect and to replay a completed trip. */
export interface RideTrackingPointDto {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  at: string;
}

export const RIDE_AUDIT_ACTIONS = {
  REQUESTED: 'ride.requested',
  CANCELLED: 'ride.cancelled',
  OFFERED: 'ride.offered',
  OFFER_ACCEPTED: 'ride.offer_accepted',
  OFFER_DECLINED: 'ride.offer_declined',
  OFFER_EXPIRED: 'ride.offer_expired',
  NO_DRIVERS_FOUND: 'ride.no_drivers_found',
} as const;

export type RideAuditAction = (typeof RIDE_AUDIT_ACTIONS)[keyof typeof RIDE_AUDIT_ACTIONS];
