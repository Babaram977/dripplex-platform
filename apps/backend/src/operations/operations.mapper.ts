import type {
  FleetDriverDto,
  FleetDriverStatus,
  IncidentQueueItemDto,
  LiveRideDto,
  OperationsCaseBaseDto,
  OperationsCaseEventDto,
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
  SosAlert,
  User,
} from '@prisma/client';

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
