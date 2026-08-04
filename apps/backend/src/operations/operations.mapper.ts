import type { FleetDriverDto, FleetDriverStatus, LiveRideDto } from '@dripplex/types';
import type { DriverAvailability, DriverProfile, Ride, User } from '@prisma/client';

export function toFleetDriverDto(input: {
  profile: DriverProfile;
  user: User;
  status: FleetDriverStatus;
  hasOpenSos: boolean;
  isSuspended: boolean;
  needsInspection: boolean;
  availability: DriverAvailability | undefined;
  activeRideId: string | null;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehiclePlateNumber: string | null;
}): FleetDriverDto {
  return {
    driverId: input.profile.userId,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
    phone: input.user.phone,
    status: input.status,
    hasOpenSos: input.hasOpenSos,
    isSuspended: input.isSuspended,
    needsInspection: input.needsInspection,
    online: input.availability?.online ?? false,
    acceptingRides: input.availability?.acceptingRides ?? false,
    latitude: input.availability?.latitude ? Number(input.availability.latitude) : null,
    longitude: input.availability?.longitude ? Number(input.availability.longitude) : null,
    vehicleType: input.availability?.vehicleType ?? null,
    activeRideId: input.activeRideId,
    shiftStatus: input.shiftStatus,
    vehiclePlateNumber: input.vehiclePlateNumber,
  };
}

export function toLiveRideDto(ride: Ride & { customer: User; driver: User | null }): LiveRideDto {
  return {
    rideId: ride.id,
    status: ride.status as LiveRideDto['status'],
    rideType: ride.rideType,
    customerId: ride.customerId,
    customerName: `${ride.customer.firstName} ${ride.customer.lastName}`,
    driverId: ride.driverId,
    driverName: ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : null,
    pickupLatitude: Number(ride.pickupLatitude),
    pickupLongitude: Number(ride.pickupLongitude),
    pickupAddress: ride.pickupAddress,
    dropoffLatitude: Number(ride.dropoffLatitude),
    dropoffLongitude: Number(ride.dropoffLongitude),
    dropoffAddress: ride.dropoffAddress,
    requestedAt: ride.requestedAt.toISOString(),
    assignedAt: ride.assignedAt ? ride.assignedAt.toISOString() : null,
  };
}
