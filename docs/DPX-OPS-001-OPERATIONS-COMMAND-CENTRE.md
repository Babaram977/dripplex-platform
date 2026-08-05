# DPX-OPS-001 — Operations Command Centre (Future Module)

**Status: Slice 1 (Live Operations Dashboard) shipped (2026-08-04). Slice 2
(Operations Work Queues) shipped (2026-08-05). Slices 3-4 (Dispatch
Management, Analytics) not yet started.** See
`docs/DPX-OPS-001-REALITY-AUDIT.md` for the full backend-capability audit,
gap analysis, proposed Phase 1 slice plan, and the founder's locked-in
refinements — this document stays the scope record, that one is the
audit/plan/approval record. Manual ride reassignment is tracked separately:
`docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md`.

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
