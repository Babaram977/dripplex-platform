import type { RideType } from '../ride/index.js';

export type { RideType };

/**
 * DPX-OPS-001 Slice 1 — composite, priority-ordered driver status for the
 * Live Fleet Map and driver list. Computed server-side
 * (`OperationsFleetService`) from several existing tables — not a stored
 * field anywhere. Priority when a driver matches more than one condition
 * (highest wins): SOS > SUSPENDED > NEEDS_INSPECTION > BUSY > AVAILABLE >
 * OFFLINE. Safety/compliance flags outrank routine activity status, per
 * the founder's own ordering ("SOS drivers (highest priority)...").
 */
export type FleetDriverStatus =
  'SOS' | 'SUSPENDED' | 'NEEDS_INSPECTION' | 'BUSY' | 'AVAILABLE' | 'OFFLINE';

export interface FleetDriverDto {
  driverId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: FleetDriverStatus;
  /** True whenever `status` reflects one of these, surfaced individually
   * too so the UI can badge more than one condition on the same driver
   * (e.g. a SUSPENDED driver who is also flagged NEEDS_INSPECTION). */
  hasOpenSos: boolean;
  isSuspended: boolean;
  needsInspection: boolean;
  online: boolean;
  acceptingRides: boolean;
  latitude: number | null;
  longitude: number | null;
  vehicleType: RideType | null;
  activeRideId: string | null;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehiclePlateNumber: string | null;
}

export interface FleetSummaryDto {
  totalDrivers: number;
  onlineCount: number;
  availableCount: number;
  busyCount: number;
  offlineCount: number;
  sosCount: number;
  suspendedCount: number;
  needsInspectionCount: number;
}

export interface OperationsFleetSnapshotDto {
  drivers: FleetDriverDto[];
  summary: FleetSummaryDto;
}

/** Ride statuses this module treats as "live" — everything between a
 * request existing and it being fully settled. Mirrors `RideStatus` from
 * `../ride/index.js`, not re-declared, to avoid drift with the frozen Ride
 * module's own enum. */
export type LiveRideStatus =
  'REQUESTED' | 'SEARCHING' | 'DRIVER_ASSIGNED' | 'ARRIVED' | 'IN_PROGRESS';

export interface LiveRideDto {
  rideId: string;
  status: LiveRideStatus;
  rideType: RideType;
  customerId: string;
  customerName: string;
  driverId: string | null;
  driverName: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  requestedAt: string;
  assignedAt: string | null;
}

export interface RideQueueSummaryDto {
  pendingCount: number;
  assignedCount: number;
  inProgressCount: number;
}

export interface OperationsRideQueueDto {
  rides: LiveRideDto[];
  summary: RideQueueSummaryDto;
}
