import type {
  DriverAvailabilityDto,
  RideCategoryRatings,
  RideDto,
  RideOfferDto,
  RideProblemReportDto,
  RideRatingDto,
} from '@dripplex/types';
import type {
  DriverAvailability,
  Ride,
  RideOffer,
  RideProblemReport,
  RideRating,
} from '@prisma/client';

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
    paymentMethod: ride.paymentMethod,
    paymentStatus: ride.paymentStatus,
    platformCommission: ride.platformCommission !== null ? Number(ride.platformCommission) : null,
    driverEarning: ride.driverEarning !== null ? Number(ride.driverEarning) : null,
    tipAmount: ride.tipAmount !== null ? Number(ride.tipAmount) : null,
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

export function toDriverAvailabilityDto(availability: DriverAvailability): DriverAvailabilityDto {
  return {
    driverId: availability.driverId,
    online: availability.online,
    acceptingRides: availability.acceptingRides,
    vehicleType: availability.vehicleType,
    latitude: availability.latitude !== null ? Number(availability.latitude) : null,
    longitude: availability.longitude !== null ? Number(availability.longitude) : null,
    activeRideCount: availability.activeRideCount,
    updatedAt: availability.updatedAt.toISOString(),
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

export function toRideRatingDto(rating: RideRating): RideRatingDto {
  return {
    id: rating.id,
    rideId: rating.rideId,
    raterId: rating.raterId,
    rateeId: rating.rateeId,
    raterRole: rating.raterRole,
    rating: rating.rating,
    comment: rating.comment,
    categoryRatings: (rating.categoryRatings as RideCategoryRatings | null) ?? null,
    createdAt: rating.createdAt.toISOString(),
  };
}

export function toRideProblemReportDto(report: RideProblemReport): RideProblemReportDto {
  return {
    id: report.id,
    rideId: report.rideId,
    reporterId: report.reporterId,
    category: report.category,
    description: report.description,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
  };
}
