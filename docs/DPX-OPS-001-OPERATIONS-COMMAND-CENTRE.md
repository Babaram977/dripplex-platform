# DPX-OPS-001 — Operations Command Centre (Future Module)

**Status: Slice 1 (Live Operations Dashboard) shipped (2026-08-04). Slice 2
(Operations Work Queues) 🔒 Founder Approved / Frozen (2026-08-05). Slice 3
(Dispatch Management) 🔒 Founder Approved / Frozen (2026-08-05). Slice 4
(Operations Analytics) not yet started — reality audit in progress.** See
`docs/DPX-OPS-001-REALITY-AUDIT.md` for the full backend-capability audit,
gap analysis, proposed Phase 1 slice plan, and the founder's locked-in
refinements — this document stays the scope record, that one is the
audit/plan/approval record. Manual ride reassignment is tracked separately:
`docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md` — Slice 3 shipped that
document's visibility half only; the action half stays deferred.

**🔒 Standing instruction — read before touching `packages/ui`:**
`docs/DPX-OPS-001-FIGMA-PROTECTION-RULE.md` (founder, 2026-08-05). All
Figma-derived Ride/Marketplace/Wallet/Driver screens are visually frozen.
DPX-OPS-001 may read platform data freely, but must never modify the
appearance of an existing Figma-derived screen, and must never change a
Locked `packages/ui` component's existing rendering to fit an Operations
Console need — new Operations-specific components, or strictly additive/
backward-compatible shared-component extensions, only. Every slice's
Production Audit must include the regression check that doc specifies.

## Slice 1 — Live Operations Dashboard (shipped 2026-08-04)

Read-only, per the founder's slice sequencing. Built end-to-end without
touching `rides/` (the founder's cross-module-read pattern, established by
`SosAlertService`/`DriverRideContactService`):

- **Backend** — `apps/backend/src/operations/` (new module):
  `OperationsFleetService.getFleetSnapshot()` composes a live
  `FleetDriverStatus` (SOS > SUSPENDED > NEEDS_INSPECTION > BUSY > AVAILABLE
  > OFFLINE, priority-ordered per the founder's own list) for every
  > approved/suspended driver from `DriverProfile`/`DriverAvailability`/
  > `SosAlert`/`DriverShift`/`Vehicle`/`Inspection`/`Ride` — all read-only.
  > `OperationsRideQueueService.getRideQueue()` reads live `Ride` rows
  > (requested through in-progress) the same way. Both gated by one new
  > permission, `operations:live:read` (granted to `operations_staff`,
  > `administrator`, `super_administrator`).
- **SDK** — `packages/sdk/src/operations/`: `OperationsFleetClient`,
  `OperationsRidesClient`, wired into `createAdminSdk()`.
- **operations-console** — `AppShell` (top nav: Live Fleet Map, Ride Queue),
  the Live Fleet Map home screen (`FleetMap` with a Google Maps view when
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured, a full-fidelity sorted
  list fallback when it isn't — the founder's required "first screen
  operators see," framed as "the air traffic control screen for
  DrippleX"), fleet summary KPI tiles, and a driver roster below the map.
  The Ride Queue screen mirrors the same pattern for live rides. Both poll
  every 15s.
- **Tests** — 14 new backend tests (`operations-fleet.service.spec.ts`,
  `operations-ride-queue.service.spec.ts`, unit + live-DB), 2 new SDK
  client tests. `prisma-foundation.spec.ts` bumped to 103 permission seeds.
- **Verification** — backend/SDK/operations-console `tsc`, `eslint
--max-warnings=0`, `jest`/`vitest`, and `next build` all clean.

## Slice 2 — Operations Work Queues (shipped 2026-08-05)

Founder-approved in full, verbatim, per the founder's structured Slice 2
approval message (2026-08-05) — see that message for the exact scope,
Operations Philosophy, Standard Workflow, Assignment model, unified Priority
system, SLA tracking, timeline format, search/filter list, dashboard
counters, and the "one addition" (Live Activity Feed) it specifies. Built
under the same architecture discipline as Slice 1: shared models, shared
SDK, shared permissions, no duplicate business logic, and — per the
founder's explicit instruction — the frozen `drivers/sos`, `drivers/
incidents`, and `drivers/support` modules were **not modified**.

- **Schema** — new `OperationsCase`/`OperationsCaseEvent` wrapper-table
  layer (`apps/backend/prisma/schema.prisma`), one case row per
  SOS/Incident/Support source row (`@@unique([caseType, sourceId])`), an
  immutable event-timeline table. This is intentionally a layer _on top of_
  the frozen source tables, not a replacement — priority, lifecycle status
  (`NEW → ASSIGNED → IN_PROGRESS → WAITING → RESOLVED → CLOSED`),
  assignment (unassigned/operator/supervisor), and SLA timestamps
  (`firstRespondedAt`/`resolvedAt`/`closedAt`) all live on the case, while
  the source tables stay the system of record for the domain data itself
  and get their own status kept in sync one-directionally
  (`OperationsCasesService.syncSourceStatus()` calls straight through to
  `SosAlertService`/`IncidentReportService`/`DriverSupportService`'s
  existing update methods — never a direct write to the source table).
- **Backend** — `apps/backend/src/operations/operations-cases.service.ts`:
  lazily get-or-creates case rows in batch (`ensureCases`, 2-3 queries
  regardless of queue size — same anti-N+1 discipline as Slice 1's polled
  endpoints), lists each of the three queues with status/priority/operator/
  search filtering, assigns/reassigns, transitions lifecycle status
  (stamping SLA timestamps), and appends notes to the event timeline. SOS
  cases default to `CRITICAL` priority always, per the founder's explicit
  instruction; Incident priority derives from `IncidentSeverity`; Support
  defaults to `MEDIUM`. `operations-dashboard.service.ts` adds
  `getQueueCounters()` (Active SOS / Open Incidents / Open Support Tickets /
  Waiting Reviews — delegates straight to the cases service, no duplicated
  logic, per the founder's explicit instruction) and `getActivityFeed()`
  (the founder's "one addition": a read-only, non-persisted feed composed
  by merging six parallel queries over existing timestamped rows —
  SOS/Incident/Inspection/Shift-start/Shift-end/Ride-cancellation — sorted
  by `occurredAt` desc. Driver online/offline transitions are deliberately
  **not** included: there is no history table for that state without
  touching frozen availability-update code, documented as an honest gap
  rather than dropped silently). Two new controllers-worth of endpoints
  gated by two new permissions, `operations:queues:read` (view) and
  `operations:queues:manage` (assign/transition/note), both granted to
  `operations_staff`/`administrator`/`super_administrator`.
- **SDK** — `packages/sdk/src/operations/`: `OperationsQueuesClient`,
  `OperationsCasesClient`, `OperationsDashboardClient`,
  `OperationsStaffClient` (assignable-operator/supervisor lookup), all
  wired into `createAdminSdk()`.
- **operations-console** — three queue-list screens (SOS Queue, Driver
  Support Queue, Incident Queue) with status/priority/operator/search
  filters; three case-detail screens with priority + lifecycle badges, the
  immutable event timeline, assignment/status controls, and a note form;
  the home dashboard now also shows the four queue-counter tiles and a
  "Live activity" panel alongside the Slice 1 fleet map.
- **Tests** — 10 new `operations-cases.service.spec.ts` tests + 2 new
  `operations-dashboard.service.spec.ts` tests (unit + live-DB, same
  pattern as Slice 1), 4 new SDK client test files.
  `prisma-foundation.spec.ts` bumped to 105 permission seeds.
- **Verification** — backend/SDK/operations-console `tsc`, `eslint
--max-warnings=0`, `jest`/`vitest`, and `next build` all clean.

**Refinement (2026-08-05) — Date/Ride/Vehicle filters, founder-approved
before the Slice 2 Production Audit.** The founder resolved both of the
gaps recorded above at Slice 2's initial ship:

- **Date/Ride/Vehicle filtering added; Region deliberately deferred.**
  `OperationsQueueFilter` (`operations-cases.service.ts`) now accepts
  `dateFrom`/`dateTo` (an inclusive `createdAt` range, pushed down into
  each source table's own `where` clause — every source row has
  `createdAt`) and `rideId`/`vehicleId`. Coverage follows what the frozen
  source tables actually store, not an invented uniform shape: `SosAlert`
  has both `rideId` and `vehicleId`, so the SOS queue supports every
  filter; `IncidentReport` has `rideId` only, so the Incident queue
  supports Date + Ride; `DriverSupportTicket` has neither, so the Support
  queue supports Date only. A `rideId`/`vehicleId` filter passed to a
  queue that structurally can't satisfy it returns an empty result rather
  than being silently ignored (`getIncidentQueue`/`getSupportQueue` short
  -circuit before querying). `operations-console`'s three queue screens
  each show only the filter controls their queue can actually honor
  (`QueueFilterBar`). Region stays out of scope — deferred until DrippleX
  has a canonical operational geography/zone model, per the founder's
  explicit instruction not to invent one just to satisfy this filter.
- **`IncidentCategory` stays frozen.** "Lost & found" and "Complaint
  escalation" are not added to it. Per the founder's decision, those
  become future shared platform support/incident capabilities (a
  cross-module ticket/incident taxonomy, not an Operations-Console-only
  addition) rather than a one-off enum change to satisfy this console.
  Phase 1 faithfully exposes the five incident categories that actually
  exist — `ACCIDENT`/`PASSENGER_ALTERCATION`/`VEHICLE_BREAKDOWN`/
  `SAFETY_CONCERN`/`OTHER`.
- **Concurrency hardening — idempotent lazy case creation.** The founder
  flagged `OperationsCase`'s get-or-create as important platform
  infrastructure worth stress-testing for multi-operator races, not just
  UI-level testing. The original `ensureCases()` batched a `createMany({
skipDuplicates: true })` with a follow-up re-read to log each case's
  CREATED timeline event — under a genuine race (two operators, or one
  operator's UI double-firing, polling the same queue before either has a
  case for a brand-new SOS/incident/support row), every racing caller's
  re-read could see the same winner's row and each log its own duplicate
  "Case created" event. Fixed: `ensureCases()` now inserts each missing
  case individually via `create()`; a unique-constraint violation
  (`@@unique([caseType, sourceId])`) means another concurrent call won the
  race, and that caller re-reads the winner's row without logging its own
  event. Verified with two new live-DB tests firing concurrent (2-way and
  5-way) requests against the same new SOS alert and asserting exactly one
  `OperationsCase` row and exactly one CREATED event — see
  `operations-cases.service.spec.ts`'s "concurrent lazy case creation"
  block.
- **Tests** — 4 new filter tests + 2 new concurrency tests (16 total in
  `operations-cases.service.spec.ts`, up from 10); full backend/SDK/
  operations-console `tsc`/`eslint --max-warnings=0`/`jest`/`vitest`/
  `next build` re-verified clean.

### 🔒 Slice 2 — Founder Approved / Frozen (2026-08-05)

Founder reviewed `docs/DPX-OPS-001-SLICE-2-PRODUCTION-AUDIT.md`'s findings
(zero launch-blocking, one concurrency defect found and fixed in the same
pass) and approved freeze in full, verbatim quote: "the final refinement
closed the important operational gap" — unified `OperationsCase` lifecycle/
assignment/SLA/timeline across all three queues, Date/Ride/Vehicle
filtering scoped to what the data genuinely supports, Region deliberately
deferred rather than fabricated, `IncidentCategory` preserved frozen, queue
counters + Live Activity Feed, SDK + Console integration, permission
boundaries, and frozen Ride/Driver boundaries all verified. The founder
specifically called out the concurrency finding as valuable: "The unique
case constraint protected the case record, but the duplicate `CREATED`
timeline-event race could have damaged the integrity of the operational
audit trail" — exactly what the production audit's concurrency test was
for.

**Freeze boundary, founder's own words**: "From this point, Slice 2 should
accept only critical defects/security fixes, performance improvements,
compliance changes, or explicitly Founder-approved enhancements." The two
deferred items stay deferred on their own terms, not as an oversight:
Region filtering waits for a canonical operational geography/zone model;
Lost & Found/Complaint Escalation belong to a future shared platform
support/incident architecture, not a reopening of the frozen Driver
incident model.

## Slice 3 — Dispatch Management (🔒 Founder Approved / Frozen, 2026-08-05)

Founder-approved to implement, verbatim, after reviewing
`docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md`'s five-item visibility-only
scope. Ships the founder's five named capabilities exactly, plus the
standing `docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md` boundary
untouched: **no manual reassignment action exists anywhere in Slice 3.**

- **Backend** — `apps/backend/src/operations/operations-ride-detail.service.ts`
  (ride detail — the full `RideDto` shape with resolved customer/driver
  identity, plus a `noDriversFound` flag that keeps `NO_DRIVERS_FOUND`
  honestly distinct from a real cancellation rather than fabricating
  `cancelledBy: SYSTEM` metadata the platform never actually records; and
  driver allocation history, reading `RideOffer` rows directly) and
  `operations-dispatch-support.service.ts` (trip monitoring off
  `RideTracking`, and the DPX-RIDE-201 decision-support panel — a new
  operations-side nearby-driver query, full-fidelity and driver-identified
  unlike the customer-facing map's privacy-fuzzed one, capped to the 10
  nearest within 10km for decision-support usability rather than left
  unbounded, with rating aggregates via the same `RideRating.aggregate`
  shape `DriversService.getOwnPerformanceStats` already uses). Also
  surfaces `hasOpenSos` on the ride detail (a read of `SosAlert.rideId`,
  the founder's own explicit "SOS" exception category). All endpoints
  extend `OperationsRidesController` under the existing Slice 1
  `operations:live:read` permission — no new permission needed for a
  read-only extension. `apps/backend/src/rides/` was never touched; two
  small pure formulas (`haversineMeters`, the constant-speed ETA estimate)
  are deliberately duplicated from the frozen `ride-fare.service.ts` rather
  than imported, matching the "operations/ never imports rides/" boundary
  every prior slice held to.
- **SDK** — `OperationsRidesClient` extended with `getRideDetail`/
  `getRideAllocation`/`getTripTracking`/`getDispatchCandidates`.
- **operations-console** — a new `/rides/[id]` detail view, reachable by
  clicking any row in Slice 1's existing ride queue. Follows the founder's
  own ordering for what an operator should be able to answer quickly:
  where is the trip → what state → who's involved → what happened during
  dispatch → is there a problem → what options are available. An
  `ExceptionBanner` gives the founder's named exception categories (SOS,
  stalled/unassigned, repeated offer failures, cancellations,
  `NO_DRIVERS_FOUND`) strong visual priority right under the header, per
  the founder's explicit UX direction — computed client-side from
  already-fetched data, no new backend logic. The "Reassign Driver" panel
  shows the decision-support list — nearby drivers, distance, an ETA
  clearly labeled as an estimate, rating — with **no assignment control
  anywhere in the component**; it's fetched lazily, only once an operator
  opens it, not on the page's 15s poll.
- **Tests** — 8 new backend tests (`operations-ride-detail.service.spec.ts`,
  `operations-dispatch-support.service.spec.ts`, unit + live-DB, same
  pattern as every prior slice).
- **Verification** — backend/SDK/operations-console `tsc`, `eslint
--max-warnings=0`, `jest`/`vitest`, and `next build` all clean.
- **Scoping note, not a gap**: the "Live location" section is
  text/coordinate-first (last known point, staleness, speed), not a second
  full map implementation — MAPS-UI already renders this exact
  `RideTracking` data on a map for the ride's own customer/driver, and
  duplicating that map just for this internal view wasn't part of what the
  founder approved. A map view remains a reasonable future enhancement.

### 🔒 Slice 3 — Founder Approved / Frozen (2026-08-05)

Founder reviewed `docs/DPX-OPS-001-SLICE-3-PRODUCTION-AUDIT.md`'s findings
(zero launch-blocking) and approved freeze in full: Ride Detail, Driver
Allocation History, 15-second live trip monitoring, truthful cancellation/
`NO_DRIVERS_FOUND` handling, and DPX-RIDE-201 decision support are all
implemented and verified — and, "more importantly," the frozen Ride
boundary is structurally protected: no `rides/` changes, no Ride-module
imports, GET-only Operations endpoints, no reassignment mutation anywhere
in the new code.

The founder specifically approved two scoping decisions as correct, not
merely acceptable:

- **Text/coordinate-first trip monitoring.** "We don't need to duplicate
  MAPS-UI merely to claim a map exists; the Operations layer can consume
  the real tracking data now, and richer command-centre mapping can evolve
  deliberately."
- **`isEstimate: true` on dispatch-candidate ETA.** "Operators must not
  mistake a straight-line constant-speed estimate for traffic-aware
  navigation."

**Freeze boundary, same rule as Slice 2**: from this point, Slice 3 accepts
only critical security/defect fixes, performance/compliance work, or
explicitly Founder-approved enhancements. Manual reassignment stays the
deferred DPX-RIDE-201 action half — a Ride-module mutation design brought
back for its own separate founder approval, never a quiet reopening of
this frozen slice.

Founder-recorded (2026-08-04), alongside
approval of the Driver Slice 2 freeze: the production audit's one outstanding
observation — real, permission-gated admin-side SOS/incident/support/shift
endpoints exist with no operations-console or admin-portal screen consuming
any of them yet — is not a Driver Slice 2 defect. It's the next module. This
document exists so that whoever scopes it starts from what's actually already
built (real backend, real permissions, real notification wiring) rather than
re-discovering it, the same way `DPX-DRIVER-005` preserves Slice 2's SOS
foundation for its own future response-workflow module.

## Founder's scope for this module

Recorded verbatim from the founder's messages, as the actual requirement list
this module needs to satisfy — not assumed or expanded here. Original framing
(freeze-approval message): consolidate driver monitoring, live fleet overview,
SOS response, incident management, support ticket management, shift
supervision, driver status, escalation workflows, dispatch oversight, and
operations dashboards into one Operations Command Centre — the platform's
mission control centre, not "another admin dashboard" — rather than scattering
them across separate admin screens.

**Detailed phasing (module-open approval message, 2026-08-04):**

**Phase 1 — Core Operations:**

- **Fleet Operations**: live driver locations, driver online/offline status,
  current trips, vehicle status, shift status, inspection status.
- **Emergency Operations**: live SOS queue, active emergency incidents,
  escalation workflow, incident timeline, dispatcher assignment, resolution
  tracking.
- **Support Centre**: driver support tickets, customer support tickets,
  merchant support tickets, internal notes, ticket assignment, SLA
  monitoring.
- **Incident Management**: accident reports, customer complaints, driver
  misconduct, lost & found, vehicle issues, investigation workflow.
- **Dispatch Oversight**: live ride queue, driver allocation, manual
  reassignment, trip monitoring, cancellation monitoring.

**Phase 2 (once Phase 1 is stable)**: operations analytics, live KPIs, heat
maps, demand forecasting, driver utilization, Marketplace monitoring, Wallet
monitoring, fraud alerts, platform health dashboard.

**Guiding principle**: every screen should answer "what is happening right
now / what requires attention right now / what needs escalation right now" —
helping Operations staff make decisions quickly, not just displaying data.

**Reality audit and Phase 1 build plan**: `docs/DPX-OPS-001-REALITY-AUDIT.md`
— per-sub-area backend capability audit, gap analysis, and a proposed slice
sequence, submitted for founder review before implementation begins.

## What already exists (real, not this module's job to rebuild)

Every one of the founder's scope items already has real backend capability to
build against — verified in `docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md`:

- **SOS response** — `SosAlertService`/`SosAlert`
  (`apps/backend/src/drivers/sos/`), `admin:drivers:sos-alert:manage`-gated
  `GET/PATCH /admin/sos-alerts`. Durable record before notification,
  `OPEN → ACKNOWLEDGED → RESOLVED` status, `CRITICAL`-priority broadcast to
  every permission-holder. The deeper response workflow (dispatcher
  assignment, escalation ladder, full timeline) is its own deferred document,
  `docs/DPX-DRIVER-005-EMERGENCY-RESPONSE-WORKFLOW.md` — this module is where
  that document's UI would actually live once both are scoped together.
- **Incident management** — `IncidentReportService`/`IncidentReport`
  (`apps/backend/src/drivers/incidents/`), `admin:drivers:incident-report:manage`-gated
  `GET/PATCH /admin/incident-reports`. Real severity/category taxonomy,
  acknowledge/resolve lifecycle, optional `rideId` linkage.
- **Support ticket management** — `DriverSupportService`/`DriverSupportTicket`
  (`apps/backend/src/drivers/support/`), `admin:drivers:support-ticket:manage`-gated
  `GET/PATCH /admin/driver-support-tickets`. Real category taxonomy,
  resolve/close lifecycle.
- **Shift supervision** — `DriverShiftService`
  (`apps/backend/src/drivers/shifts/`), `admin:drivers:shifts:manage`-gated
  `GET /admin/driver-shifts` (paginated, filterable) and force-end
  (`PATCH .../force-end`) for abandoned/stuck shifts.
  `DriverShiftReminderSweepService` already computes and pushes the
  break/fatigue/daily-limit signals this module's dashboards would surface.
- **Driver status / driver monitoring** — `DriversService.listDrivers()`
  (`admin:drivers:review`), `DriverAvailability` (online/offline, accepting
  rides, location, vehicle type) — real-time driver state already exists,
  just not surfaced in an operations-facing list/map view.
- **Dispatch oversight** — `RideGateway`'s real-time WebSocket dispatch
  events (ride offers, assignment, driver location) already exist for the
  Ride module; an operations-facing consumer of that same event stream
  doesn't yet exist.

**Live fleet overview** and **operations dashboards** are the two items
without a direct existing backend surface to point at — they're genuinely
aggregate/derived views (real-time driver locations + active-shift counts +
open-queue counts, etc.) that this module would need to build, likely by
composing the above rather than needing new domain models.

## Extension points to preserve until this is scoped

- **No new permission model is assumed.** The four `admin:*:manage`
  permissions already gating these endpoints are the seed; whether this
  module needs its own role tier (e.g. a dedicated "Operations" role
  bundling all four plus dispatch) is a decision for that scoping pass, not
  pre-decided here.
- **`NotificationCenterService` stays the delivery mechanism** for anything
  this module needs to push to operations staff — no new transport layer is
  implied.
- **Nothing in Driver Slice 2's backend needs to change to build this** — the
  audit confirmed every relevant endpoint is real, permission-gated, and
  already returns exactly the data an operations UI would need. This is a
  pure consumption-side module, not a backend-and-frontend module the way
  Slice 2 itself was.

## Why this was safe to defer until now

Driver Slice 2 was explicitly scoped as driver-facing capability — a driver
being able to report an incident, request help, manage their shift, and
trigger SOS. Whether Operations has a dedicated console to respond was a
distinct, real question that didn't block any of those driver-facing
capabilities from being correct, real, and frozen on their own terms. That
question is now this module's entire reason for existing — see
`docs/DPX-OPS-001-REALITY-AUDIT.md` for what's actually next.
