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

export const RIDE_AUDIT_ACTIONS = {
  REQUESTED: 'ride.requested',
  CANCELLED: 'ride.cancelled',
} as const;

export type RideAuditAction = (typeof RIDE_AUDIT_ACTIONS)[keyof typeof RIDE_AUDIT_ACTIONS];
