import type {
  DriverSupportCategory,
  DriverSupportTicketStatus,
  IncidentCategory,
  IncidentReportStatus,
  IncidentSeverity,
  SosAlertStatus,
} from '../driver/index.js';
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

/**
 * DPX-OPS-001 Slice 2 — Operations Work Queues (founder-approved
 * 2026-08-04). `OperationsCase` wraps a `SosAlert`/`IncidentReport`/
 * `DriverSupportTicket` row with the operational concepts those frozen
 * Driver Slice 2 tables don't have: a unified priority, a unified
 * six-stage lifecycle, operator/supervisor assignment, and SLA
 * timestamps. The source table's own status stays the driver-facing
 * source of truth — `sourceStatus` on each queue item DTO below.
 */
export type OperationsCaseType = 'SOS' | 'INCIDENT' | 'SUPPORT';

/** SOS cases always default to CRITICAL. Incident cases default from the
 * report's own severity (the two enums share the same four values). */
export type OperationsPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** The founder's standard workflow: New -> Assigned -> In Progress ->
 * Waiting -> Resolved -> Closed. Not strictly linear — a case can move
 * back to WAITING from IN_PROGRESS, and RESOLVED can reopen to
 * IN_PROGRESS before CLOSED. */
export type OperationsLifecycleStatus =
  'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';

export type OperationsAssigneeRole = 'OPERATOR' | 'SUPERVISOR';

export type OperationsCaseEventType =
  'CREATED' | 'PRIORITY_CHANGED' | 'ASSIGNED' | 'UNASSIGNED' | 'STATUS_CHANGED' | 'NOTE_ADDED';

export interface OperationsCaseEventDto {
  id: string;
  eventType: OperationsCaseEventType;
  actorId: string | null;
  actorName: string | null;
  description: string;
  createdAt: string;
}

/** Fields common to every queue item, regardless of case type. */
export interface OperationsCaseBaseDto {
  caseId: string;
  caseType: OperationsCaseType;
  sourceId: string;
  priority: OperationsPriority;
  status: OperationsLifecycleStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: OperationsAssigneeRole | null;
  assignedAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  driverId: string;
  driverName: string;
  driverPhone: string | null;
}

export interface SosQueueItemDto extends OperationsCaseBaseDto {
  caseType: 'SOS';
  sourceStatus: SosAlertStatus;
  rideId: string | null;
  vehicleId: string | null;
  latitude: number | null;
  longitude: number | null;
  batteryLevel: number | null;
  adminNotes: string | null;
}

export interface IncidentQueueItemDto extends OperationsCaseBaseDto {
  caseType: 'INCIDENT';
  sourceStatus: IncidentReportStatus;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  rideId: string | null;
  adminNotes: string | null;
}

export interface SupportQueueItemDto extends OperationsCaseBaseDto {
  caseType: 'SUPPORT';
  sourceStatus: DriverSupportTicketStatus;
  category: DriverSupportCategory;
  subject: string;
  description: string;
  adminResponse: string | null;
}

export interface OperationsQueueCountersByStatus {
  newCount: number;
  assignedCount: number;
  inProgressCount: number;
  waitingCount: number;
  resolvedCount: number;
  closedCount: number;
}

export interface SosQueueDto {
  items: SosQueueItemDto[];
  summary: OperationsQueueCountersByStatus;
}

export interface IncidentQueueDto {
  items: IncidentQueueItemDto[];
  summary: OperationsQueueCountersByStatus;
}

export interface SupportQueueDto {
  items: SupportQueueItemDto[];
  summary: OperationsQueueCountersByStatus;
}

export interface SosCaseDetailDto extends SosQueueItemDto {
  events: OperationsCaseEventDto[];
}

export interface IncidentCaseDetailDto extends IncidentQueueItemDto {
  events: OperationsCaseEventDto[];
}

export interface SupportCaseDetailDto extends SupportQueueItemDto {
  events: OperationsCaseEventDto[];
}

export type OperationsCaseDetailDto =
  SosCaseDetailDto | IncidentCaseDetailDto | SupportCaseDetailDto;

export interface UpdateOperationsCaseRequest {
  priority?: OperationsPriority;
  status?: OperationsLifecycleStatus;
  /** Pass a user id to assign, or `null` to unassign. Omit to leave
   * assignment unchanged. */
  assignedToId?: string | null;
  assignedToRole?: OperationsAssigneeRole;
}

export interface AddOperationsCaseNoteRequest {
  note: string;
}

/** Slice 1's dashboard extension — pure counts over the same three source
 * tables + `OperationsCase`, no new domain logic. */
export interface OperationsQueueCountersDto {
  activeSosCount: number;
  openIncidentsCount: number;
  openSupportTicketsCount: number;
  /** Cases across all three queues currently in WAITING status. */
  waitingReviewCount: number;
}

/** The founder's "one addition": a Live Activity Feed on the dashboard,
 * composed read-only from existing timestamped rows (SosAlert creation,
 * IncidentReport creation, Inspection completion, DriverShift start/end,
 * Ride cancellation) — no new event log. Driver online/offline transitions
 * are NOT included: `DriverAvailability` only stores current state, not a
 * history of transitions, and adding one would mean touching the frozen
 * Driver Slice 2 availability-update code path. Documented as a known gap,
 * not silently dropped. */
export type ActivityFeedEventType =
  | 'SOS_TRIGGERED'
  | 'INCIDENT_REPORTED'
  | 'INSPECTION_COMPLETED'
  | 'SHIFT_STARTED'
  | 'SHIFT_ENDED'
  | 'RIDE_CANCELLED';

export interface ActivityFeedItemDto {
  id: string;
  type: ActivityFeedEventType;
  message: string;
  occurredAt: string;
  driverId: string | null;
  driverName: string | null;
}

export interface ActivityFeedDto {
  items: ActivityFeedItemDto[];
}

/** For the "Assign operator"/"Assign supervisor" controls — every user
 * currently holding `operations:queues:manage`. */
export interface OperationsStaffMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  role: OperationsAssigneeRole;
}
