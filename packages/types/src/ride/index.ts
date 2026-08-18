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

export type RideCancelledBy = 'CUSTOMER' | 'DRIVER' | 'SYSTEM';

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
}

/** A ride as its **customer** sees it, plus the assigned driver's display
 * name — the mirror of `CustomerDeliveryDto.riderName`, so the passenger can
 * see and message a named person rather than a UUID. */
export interface CustomerRideDto extends RideDto {
  driverName: string | null;
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
  durationSeconds: number | null;
  fare: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    /** Shown as its own line rather than folded into the total — a passenger
     * charged extra for an airport run is entitled to see why. */
    surchargeAmount: number;
    surchargeZoneName: string | null;
    totalFare: number;
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
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  finalFare: number;
}

export interface DriverAvailabilityDto {
  driverId: string;
  online: boolean;
  acceptingRides: boolean;
  vehicleType: RideType;
  latitude: number | null;
  longitude: number | null;
  activeRideCount: number;
  updatedAt: string;
}

export interface UpdateDriverAvailabilityRequest {
  online: boolean;
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
