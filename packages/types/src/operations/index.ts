import type {
  DriverSupportCategory,
  DriverSupportTicketStatus,
  IncidentCategory,
  IncidentReportStatus,
  IncidentSeverity,
  SosAlertStatus,
} from '../driver/index.js';
import type {
  RideCancelledBy,
  RideOfferDto,
  RidePaymentMethod,
  RidePaymentStatus,
  RideStatus,
  RideTrackingPointDto,
  RideType,
} from '../ride/index.js';

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
  /** The driver's own toggle — what *they* believe. Left as-is deliberately:
   * an app that says "Online" while the platform has stopped hearing from it
   * is the exact discrepancy Operations needs to see, so it is reported
   * rather than smoothed over. Compare with `reachable`. */
  online: boolean;
  /** What the *platform* believes: the toggle is on AND a location ping has
   * arrived within DRIVER_LOCATION_MAX_AGE_MS. This is the same test dispatch
   * applies before offering a ride, so a driver who is `online` but not
   * `reachable` will never be sent work no matter what their app displays. */
  reachable: boolean;
  /** When the last position ping arrived; null if one never has. Lets the UI
   * say "last seen 43 min ago" instead of just contradicting the driver. */
  lastLocationAt: string | null;
  acceptingRides: boolean;
  latitude: number | null;
  longitude: number | null;
  vehicleType: RideType | null;
  activeRideId: string | null;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehiclePlateNumber: string | null;
}

/**
 * Counts over the same fleet snapshot.
 *
 * `onlineCount` + `staleCount` + `offlineCount` === `totalDrivers`, always.
 * They are the only three that partition the fleet; the rest
 * (available/busy/sos/suspended/needsInspection) are `status` breakdowns that
 * overlap the first three and each other's causes, so they must never be
 * presented as if they summed to anything.
 *
 * This used to be wrong in a way that produced impossible dashboards:
 * `onlineCount` counted the raw online flag while `offlineCount` counted the
 * computed status OFFLINE, which only applies once SOS / SUSPENDED /
 * NEEDS_INSPECTION / BUSY have been ruled out. A driver toggled online with no
 * passed inspection was counted in BOTH; a driver toggled off who also needed
 * an inspection was counted in NEITHER.
 */
export interface FleetSummaryDto {
  totalDrivers: number;
  /** Toggle on and pinging — dispatch would consider them. */
  onlineCount: number;
  /** Toggle on but silent past DRIVER_LOCATION_MAX_AGE_MS. Their app still
   * shows "Online" and they may well be sitting waiting for work, but the
   * platform has lost them and will not dispatch to them. A non-zero value
   * here is an alert, not a statistic. */
  staleCount: number;
  /** Genuinely signed off. */
  offlineCount: number;
  availableCount: number;
  busyCount: number;
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
 * DPX-OPS-001 Slice 3 — Dispatch Management (founder-approved 2026-08-05,
 * reality-audited before implementation — see
 * docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md). A ride detail view for the
 * live ride queue Slice 1 already built. Mirrors `RideDto`'s full shape
 * (the frozen Ride module's own DTO) with resolved customer/driver
 * names/phone for operator display — read-only, the same cross-module-read
 * pattern `LiveRideDto` already established for the ride queue.
 */
export interface OperationsRideDetailDto {
  rideId: string;
  status: RideStatus;
  rideType: RideType;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
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
  promoDiscount: number;
  paymentMethod: RidePaymentMethod | null;
  paymentStatus: RidePaymentStatus;
  tipAmount: number | null;
  requestedAt: string;
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: RideCancelledBy | null;
  cancellationReason: string | null;
  /** True only when dispatch exhausted every retry with no driver ever
   * accepting (`status === 'NO_DRIVERS_FOUND'`) — a distinct, real outcome
   * from a cancellation. The Slice 3 reality audit confirmed the platform
   * never stamps `cancelledBy: 'SYSTEM'` for this case (that enum value
   * exists but has zero real call sites), so this flag exists specifically
   * to let the console tell the two apart truthfully rather than
   * fabricating `SYSTEM` cancellation metadata the backend doesn't
   * record. */
  noDriversFound: boolean;
  /** True when an open (`OPEN`/`ACKNOWLEDGED`) `SosAlert` references this
   * ride — the founder's UX direction names SOS as the top exception to
   * give strong visual priority to on the ride detail view. Cross-module
   * read only (`SosAlert.rideId`, a plain scalar per that frozen model's
   * own doc comment) — `drivers/sos` is never imported or modified. */
  hasOpenSos: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One dispatch attempt for a ride — extends the frozen Ride module's own
 * `RideOfferDto` with a resolved driver name/phone for operator display. */
export interface OperationsRideOfferDto extends RideOfferDto {
  driverName: string;
  driverPhone: string | null;
}

export interface OperationsRideAllocationDto {
  /** Ordered `offeredAt` ascending — the sequence dispatch actually tried. */
  offers: OperationsRideOfferDto[];
  currentDriverId: string | null;
  currentDriverName: string | null;
}

/** Trip monitoring — the same `RideTracking` breadcrumb `RideTrackingReadService`
 * already serves to the ride's own customer, read operations-side. Polled
 * on the platform's established 15s cadence, not pushed — see the Slice 3
 * reality audit's finding that `RideGateway` has no operations-wide
 * broadcast room and adding one would touch the frozen gateway. */
export interface OperationsRideTrackingDto {
  points: RideTrackingPointDto[];
}

/** The founder's DPX-RIDE-201 decision-support panel, one candidate driver.
 * Informational only — this DTO backs a "here are the best available
 * drivers" display, never an assignment action. `etaSeconds` is always a
 * constant-speed straight-line estimate (the same formula the platform's
 * fare-estimate endpoint uses everywhere else) — `isEstimate` is always
 * `true` and exists so the console can never accidentally present this as
 * a routed, traffic-aware duration. */
export interface DispatchCandidateDto {
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  vehiclePlateNumber: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  etaSeconds: number;
  isEstimate: true;
  averageRating: number | null;
  ratingCount: number;
}

export interface DispatchSupportDto {
  candidates: DispatchCandidateDto[];
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
  /** Optimistic-concurrency token (DPX-OPS-001 module-closure audit,
   * 2026-08-05). A caller mutating this case via `UpdateOperationsCaseRequest`
   * must echo back the `version` it last read — see that request type's own
   * doc comment for what happens on a mismatch. */
  version: number;
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
  /** Required — the `version` the caller last read from
   * `OperationsCaseBaseDto`. `OperationsCasesService.updateCase()` rejects
   * the write with a 409 `CONFLICT` if the case's current version doesn't
   * match: someone else's update landed first. This is the optimistic-
   * concurrency guard the DPX-OPS-001 module-closure audit (2026-08-05)
   * added so two operators acting on the same case at once can never
   * silently overwrite each other's assignment/status/SLA state. */
  version: number;
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

/**
 * DPX-OPS-001 Slice 4 — Operations Analytics (founder-approved 2026-08-05,
 * reality-audited first — see docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md).
 * Every metric below is a live-query aggregation over real, permanent
 * records (`Ride`, `RideOffer`, `DriverShift`, `OperationsCase`) — there is
 * no pre-aggregation table and nothing here is derived from a snapshot
 * pretending to be a history. Time-range filtering is fundamental, per the
 * founder's explicit instruction: every query takes a `from`/`to` range,
 * always caller-supplied (the console computes "Today"/"Last 7 days"/
 * "Last 30 days"/custom into concrete timestamps before calling).
 */
export interface AnalyticsTimeRangeDto {
  from: string;
  to: string;
}

/**
 * The founder's own six-question framing for the first screen: how busy →
 * are rides fulfilled → are drivers utilized → is dispatch performing → is
 * Operations responding → where is demand. A small, fixed set of KPIs, not
 * a growing pile of cards — each one is a doorway into its own drill-down
 * endpoint below, not the full detail itself. Rates are 0-1 fractions, not
 * percentages, so the console controls the display format in one place.
 */
export interface OperationsAnalyticsOverviewDto {
  range: AnalyticsTimeRangeDto;
  /** How busy are we? */
  ridesRequested: number;
  /** Are rides being fulfilled? */
  ridesCompleted: number;
  completionRate: number;
  cancellationRate: number;
  noDriversFoundRate: number;
  /** Are drivers being utilized effectively? `onlineDriversNow` is a live
   * snapshot (current moment only — see the reality audit's fleet
   * -availability-trend gap), everything else is range-scoped. */
  onlineDriversNow: number;
  activeDriversInRange: number;
  averageUtilizationRate: number | null;
  /** Is dispatch performing? */
  averageTimeToAcceptSeconds: number | null;
  repeatedOfferRideRate: number;
  /** Is Operations responding quickly enough? `openCasesCount` is a live
   * snapshot (cases not yet RESOLVED/CLOSED, regardless of range);
   * `averageTimeToFirstResponseSeconds` is scoped to cases created within
   * the range. */
  openCasesCount: number;
  averageTimeToFirstResponseSeconds: number | null;
  /** Are we making money? Aggregated over rides COMPLETED inside the range —
   * a ride counts on the day it finished, matching `ridesCompleted` above.
   *
   * `grossFareRevenue` is what passengers were charged (GMV);
   * `platformCommissionRevenue` is DrippleX's own cut and is the figure the
   * dashboard leads with. Tips are excluded from both — they belong entirely
   * to the driver and were never platform revenue. */
  grossFareRevenue: number;
  platformCommissionRevenue: number;
  driverEarnings: number;
  tipsCollected: number;
  /** The same money split into buckets across the range, oldest first — what
   * the dashboard's "Revenue Over Time" chart plots. Hourly for ranges up to
   * two days, daily beyond that. Empty buckets are present with zeroes so the
   * chart shows a real flat line rather than skipping the hours nothing
   * happened in. */
  revenueSeries: RevenueBucketDto[];
}

export interface RevenueBucketDto {
  /** ISO timestamp of the bucket's start. */
  bucketStart: string;
  grossFare: number;
  platformCommission: number;
  ridesCompleted: number;
}

/** One driver's utilization row in the drill-down's ranked list —
 * `onlineSeconds` sums that driver's `DriverShift` durations in range (the
 * closest real proxy for "time available to drive"; a shift and
 * `DriverAvailability.online` are intentionally independent per
 * `DriverShift`'s own doc comment, so this is shift time, not raw online
 * time), `onTripSeconds` sums `Ride.startedAt`→`completedAt` for that
 * driver's completed rides in range. */
export interface DriverUtilizationRowDto {
  driverId: string;
  driverName: string;
  tripsCompleted: number;
  earnings: number;
  onlineSeconds: number;
  onTripSeconds: number;
  /** `onTripSeconds / onlineSeconds`, `null` when `onlineSeconds` is 0 (no
   * shift recorded in range — dividing by zero would fabricate a number,
   * not report one). */
  utilizationRate: number | null;
}

export interface DriverUtilizationAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  /** Drivers with at least one shift or completed ride in range. */
  driverCount: number;
  totalOnlineSeconds: number;
  totalOnTripSeconds: number;
  averageUtilizationRate: number | null;
  totalTripsCompleted: number;
  totalEarnings: number;
  /** Ranked by trips completed, capped — see `MAX_UTILIZATION_ROWS` in the
   * backend service. A drill-down list, not a full driver export. */
  topDrivers: DriverUtilizationRowDto[];
}

export interface ShiftAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  shiftsStarted: number;
  shiftsEnded: number;
  /** Live snapshot, not range-scoped — how many drivers are mid-shift
   * right now. */
  activeShiftsNow: number;
  onBreakShiftsNow: number;
  forceEndedCount: number;
  averageShiftDurationSeconds: number | null;
  averageBreakSeconds: number | null;
  breakReminderCount: number;
  fatigueWarningCount: number;
  dailyLimitNotifiedCount: number;
}

export interface RideTypeBreakdownDto {
  rideType: RideType;
  requested: number;
  completed: number;
  cancelled: number;
}

/** One point on the demand-over-time series — `bucketStart` is a UTC day
 * boundary (`YYYY-MM-DD`), `count` is rides requested that day within the
 * overall range. */
export interface DemandSeriesPointDto {
  bucketStart: string;
  count: number;
}

export interface CancellationReasonCountDto {
  reason: string;
  count: number;
}

export interface RideOperationsAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  requested: number;
  completed: number;
  cancelled: number;
  /** Kept structurally separate from `cancelled` throughout — a ride that
   * exhausted dispatch retries with no driver ever accepting is a
   * different real outcome, never folded into the cancellation count. */
  noDriversFound: number;
  completionRate: number;
  cancellationRate: number;
  noDriversFoundRate: number;
  cancelledByCustomer: number;
  cancelledByDriver: number;
  /** Real platform behaviour, not a display bug: `RideCancelledBy.SYSTEM`
   * has zero real call sites anywhere in the codebase (confirmed in both
   * the Slice 3 and Slice 4 reality audits), so this is always 0 today. */
  cancelledBySystem: number;
  byRideType: RideTypeBreakdownDto[];
  demandSeries: DemandSeriesPointDto[];
  /** Raw `Ride.cancellationReason` text, grouped and counted, capped — see
   * `MAX_CANCELLATION_REASONS`. There is no structured reason-code
   * taxonomy on `Ride`, so this is "top raw reasons," not a clean fixed
   * category breakdown. */
  topCancellationReasons: CancellationReasonCountDto[];
}

export interface DispatchPerformanceAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  totalOffers: number;
  acceptedOffers: number;
  declinedOffers: number;
  expiredOffers: number;
  acceptanceRate: number;
  averageTimeToAcceptSeconds: number | null;
  ridesWithOffers: number;
  /** Rides that needed more than one `RideOffer` — the same underlying
   * data Slice 3's per-ride `computeDispatchExceptions()` repeated-offer
   * -failure category reads, aggregated here across the whole range
   * instead of shown one ride at a time. */
  ridesNeedingRepeatedOffers: number;
  repeatedOfferRate: number;
  averageOffersPerRide: number | null;
}

export interface OperationsResponseByTypeDto {
  caseType: OperationsCaseType;
  totalCases: number;
  averageTimeToFirstResponseSeconds: number | null;
  averageTimeToResolutionSeconds: number | null;
  averageTimeToClosureSeconds: number | null;
}

/** SLA analytics across SOS/Incident/Support, uniformly — the same
 * `OperationsCase.createdAt`/`firstRespondedAt`/`resolvedAt`/`closedAt`
 * fields Slice 2 built as first-class SLA tracking, one query shape
 * across all three case types rather than three separate ones. */
export interface OperationsResponseAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  totalCases: number;
  byType: OperationsResponseByTypeDto[];
  averageTimeToFirstResponseSeconds: number | null;
  averageTimeToResolutionSeconds: number | null;
  averageTimeToClosureSeconds: number | null;
  /** Live snapshot — cases not yet RESOLVED/CLOSED right now, regardless
   * of when they were created. */
  openCasesCount: number;
}

/** One grid cell of the geographic demand aggregation. Coordinates are
 * rounded to `cellSizeDegrees` (an accurate, if coarse, spatial bucket —
 * not a named zone; see the reality audit's standing decision not to
 * invent a region model) — `latitude`/`longitude` are that cell's
 * lower-left corner. */
export interface GeographicDemandCellDto {
  latitude: number;
  longitude: number;
  pickupCount: number;
  dropoffCount: number;
}

export interface GeographicDemandAnalyticsDto {
  range: AnalyticsTimeRangeDto;
  cellSizeDegrees: number;
  cells: GeographicDemandCellDto[];
  totalPickups: number;
  totalDropoffs: number;
}
