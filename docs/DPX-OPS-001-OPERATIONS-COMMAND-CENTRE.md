# DPX-OPS-001 — Operations Command Centre (Future Module)

**Status: Slice 1 (Live Operations Dashboard) shipped (2026-08-04). Slice 2
(Operations Work Queues) not yet started.** See
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
