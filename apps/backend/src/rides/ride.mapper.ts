import type { RideDto, RideOfferDto } from '@dripplex/types';
import type { Ride, RideOffer } from '@prisma/client';

export function toRideDto(ride: Ride): RideDto {
  return {
    id: ride.id,
    customerId: ride.customerId,
    driverId: ride.driverId,
    rideType: ride.rideType,
    status: ride.status,
    pickupLatitude: Number(ride.pickupLatitude),
    pickupLongitude: Number(ride.pickupLongitude),
    pickupAddress: ride.pickupAddress,
    dropoffLatitude: Number(ride.dropoffLatitude),
    dropoffLongitude: Number(ride.dropoffLongitude),
    dropoffAddress: ride.dropoffAddress,
    estimatedDistanceMeters: ride.estimatedDistanceMeters,
    estimatedDurationSeconds: ride.estimatedDurationSeconds,
    baseFare: Number(ride.baseFare),
    distanceFare: Number(ride.distanceFare),
    timeFare: Number(ride.timeFare),
    totalFare: Number(ride.totalFare),
    requestedAt: ride.requestedAt.toISOString(),
    assignedAt: ride.assignedAt ? ride.assignedAt.toISOString() : null,
    arrivedAt: ride.arrivedAt ? ride.arrivedAt.toISOString() : null,
    startedAt: ride.startedAt ? ride.startedAt.toISOString() : null,
    completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
    cancelledAt: ride.cancelledAt ? ride.cancelledAt.toISOString() : null,
    cancelledBy: ride.cancelledBy,
    cancellationReason: ride.cancellationReason,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString(),
  };
}

export function toRideOfferDto(offer: RideOffer): RideOfferDto {
  return {
    id: offer.id,
    rideId: offer.rideId,
    driverId: offer.driverId,
    status: offer.status,
    offeredAt: offer.offeredAt.toISOString(),
    expiresAt: offer.expiresAt.toISOString(),
    respondedAt: offer.respondedAt ? offer.respondedAt.toISOString() : null,
  };
}
