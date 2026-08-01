export type RideType = 'ECONOMY' | 'TRICYCLE';

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
  totalFare: number;
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

export interface RequestRideRequest {
  rideType: RideType;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress?: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress?: string;
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
