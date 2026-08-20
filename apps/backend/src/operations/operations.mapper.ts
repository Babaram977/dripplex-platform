import { RideStatus } from '@prisma/client';

import type {
  DispatchCandidateDto,
  FleetDriverDto,
  FleetDriverStatus,
  IncidentQueueItemDto,
  LiveRideDto,
  OperationsCaseBaseDto,
  OperationsCaseEventDto,
  OperationsRideDetailDto,
  OperationsRideOfferDto,
  SosQueueItemDto,
  SupportQueueItemDto,
} from '@dripplex/types';
import type {
  DriverAvailability,
  DriverProfile,
  DriverSupportTicket,
  IncidentReport,
  OperationsCase,
  OperationsCaseEvent,
  Ride,
  RideOffer,
  SosAlert,
  User,
} from '@prisma/client';

export function toFleetDriverDto(input: {
  profile: DriverProfile;
  user: User;
  status: FleetDriverStatus;
  reachable: boolean;
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
    reachable: input.reachable,
    lastLocationAt: input.availability?.locationUpdatedAt?.toISOString() ?? null,
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

/** Renders a `${firstName} ${lastName}` from a pre-fetched user map, or
 * null if the id is null or the user isn't in the map (shouldn't happen —
 * callers batch-fetch every id they pass here — but a stale name is worse
 * than a missing one). */
function userName(userId: string | null, userMap: Map<string, User>): string | null {
  if (userId === null) return null;
  const user = userMap.get(userId);
  return user ? `${user.firstName} ${user.lastName}` : null;
}

/** DPX-OPS-001 Slice 2 — fields common to every queue item DTO, shared
 * across SOS/Incident/Support so the three concrete mappers below only
 * need to add their own source-table fields. */
export function toOperationsCaseBaseDto(
  kase: OperationsCase,
  userMap: Map<string, User>,
): OperationsCaseBaseDto {
  return {
    caseId: kase.id,
    caseType: kase.caseType,
    sourceId: kase.sourceId,
    priority: kase.priority,
    status: kase.status,
    assignedToId: kase.assignedToId,
    assignedToName: userName(kase.assignedToId, userMap),
    assignedToRole: kase.assignedToRole,
    assignedAt: kase.assignedAt ? kase.assignedAt.toISOString() : null,
    firstRespondedAt: kase.firstRespondedAt ? kase.firstRespondedAt.toISOString() : null,
    resolvedAt: kase.resolvedAt ? kase.resolvedAt.toISOString() : null,
    closedAt: kase.closedAt ? kase.closedAt.toISOString() : null,
    createdAt: kase.createdAt.toISOString(),
    updatedAt: kase.updatedAt.toISOString(),
    version: kase.version,
    // Overwritten by each concrete mapper with the real driver — placeholder
    // satisfies the shared base shape without repeating it three times.
    driverId: '',
    driverName: '',
    driverPhone: null,
  };
}

export function toSosQueueItemDto(
  alert: SosAlert & { driver: User },
  kase: OperationsCase,
  userMap: Map<string, User>,
): SosQueueItemDto {
  return {
    ...toOperationsCaseBaseDto(kase, userMap),
    caseType: 'SOS',
    sourceStatus: alert.status,
    driverId: alert.driverId,
    driverName: `${alert.driver.firstName} ${alert.driver.lastName}`,
    driverPhone: alert.driver.phone,
    rideId: alert.rideId,
    vehicleId: alert.vehicleId,
    latitude: alert.latitude ? Number(alert.latitude) : null,
    longitude: alert.longitude ? Number(alert.longitude) : null,
    batteryLevel: alert.batteryLevel,
    adminNotes: alert.adminNotes,
  };
}

export function toIncidentQueueItemDto(
  report: IncidentReport & { driver: User },
  kase: OperationsCase,
  userMap: Map<string, User>,
): IncidentQueueItemDto {
  return {
    ...toOperationsCaseBaseDto(kase, userMap),
    caseType: 'INCIDENT',
    sourceStatus: report.status,
    driverId: report.driverId,
    driverName: `${report.driver.firstName} ${report.driver.lastName}`,
    driverPhone: report.driver.phone,
    category: report.category,
    severity: report.severity,
    description: report.description,
    rideId: report.rideId,
    adminNotes: report.adminNotes,
  };
}

export function toSupportQueueItemDto(
  ticket: DriverSupportTicket & { driver: User },
  kase: OperationsCase,
  userMap: Map<string, User>,
): SupportQueueItemDto {
  return {
    ...toOperationsCaseBaseDto(kase, userMap),
    caseType: 'SUPPORT',
    sourceStatus: ticket.status,
    driverId: ticket.driverId,
    driverName: `${ticket.driver.firstName} ${ticket.driver.lastName}`,
    driverPhone: ticket.driver.phone,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    adminResponse: ticket.adminResponse,
  };
}

export function toCaseEventDto(
  event: OperationsCaseEvent,
  userMap: Map<string, User>,
): OperationsCaseEventDto {
  return {
    id: event.id,
    eventType: event.eventType,
    actorId: event.actorId,
    actorName: userName(event.actorId, userMap),
    description: event.description,
    createdAt: event.createdAt.toISOString(),
  };
}

/** DPX-OPS-001 Slice 3 — the full ride detail view. Mirrors `RideDto`'s
 * shape with resolved customer/driver names/phone, same pattern as
 * `toLiveRideDto` above. */
export function toOperationsRideDetailDto(
  ride: Ride & { customer: User; driver: User | null },
  hasOpenSos: boolean,
): OperationsRideDetailDto {
  return {
    rideId: ride.id,
    status: ride.status,
    rideType: ride.rideType,
    customerId: ride.customerId,
    customerName: `${ride.customer.firstName} ${ride.customer.lastName}`,
    customerPhone: ride.customer.phone,
    driverId: ride.driverId,
    driverName: ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : null,
    driverPhone: ride.driver?.phone ?? null,
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
    promoDiscount: Number(ride.promoDiscount),
    paymentMethod: ride.paymentMethod,
    paymentStatus: ride.paymentStatus,
    tipAmount: ride.tipAmount !== null ? Number(ride.tipAmount) : null,
    requestedAt: ride.requestedAt.toISOString(),
    assignedAt: ride.assignedAt ? ride.assignedAt.toISOString() : null,
    arrivedAt: ride.arrivedAt ? ride.arrivedAt.toISOString() : null,
    startedAt: ride.startedAt ? ride.startedAt.toISOString() : null,
    completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
    cancelledAt: ride.cancelledAt ? ride.cancelledAt.toISOString() : null,
    cancelledBy: ride.cancelledBy,
    cancellationReason: ride.cancellationReason,
    // See OperationsRideDetailDto's own doc comment — NO_DRIVERS_FOUND is a
    // real, distinct outcome the platform never stamps `cancelledBy:
    // SYSTEM` for (confirmed by the Slice 3 reality audit: zero real call
    // sites write that enum value).
    noDriversFound: ride.status === RideStatus.NO_DRIVERS_FOUND,
    hasOpenSos,
    createdAt: ride.createdAt.toISOString(),
    updatedAt: ride.updatedAt.toISOString(),
  };
}

/** One dispatch attempt, with the driver's name/phone resolved for
 * operator display — the founder's "driver allocation history." */
export function toOperationsRideOfferDto(
  offer: RideOffer & { driver: User },
): OperationsRideOfferDto {
  return {
    id: offer.id,
    rideId: offer.rideId,
    driverId: offer.driverId,
    status: offer.status,
    offeredAt: offer.offeredAt.toISOString(),
    expiresAt: offer.expiresAt.toISOString(),
    respondedAt: offer.respondedAt ? offer.respondedAt.toISOString() : null,
    driverName: `${offer.driver.firstName} ${offer.driver.lastName}`,
    driverPhone: offer.driver.phone,
  };
}

/** One candidate driver in the founder's DPX-RIDE-201 decision-support
 * panel. Takes already-resolved scalars (distance/ETA computed by the
 * caller, vehicle/rating looked up separately) rather than raw rows —
 * this composes three independent lookups, unlike every other mapper here
 * that maps one table's row straight to a DTO. */
export function toDispatchCandidateDto(input: {
  availability: DriverAvailability & { driver: User };
  distanceMeters: number;
  etaSeconds: number;
  vehiclePlateNumber: string | null;
  averageRating: number | null;
  ratingCount: number;
}): DispatchCandidateDto {
  return {
    driverId: input.availability.driverId,
    driverName: `${input.availability.driver.firstName} ${input.availability.driver.lastName}`,
    driverPhone: input.availability.driver.phone,
    vehiclePlateNumber: input.vehiclePlateNumber,
    latitude: Number(input.availability.latitude),
    longitude: Number(input.availability.longitude),
    distanceMeters: input.distanceMeters,
    etaSeconds: input.etaSeconds,
    isEstimate: true,
    averageRating:
      input.averageRating !== null ? Math.round(input.averageRating * 100) / 100 : null,
    ratingCount: input.ratingCount,
  };
}
