# DPX-OPS-001 — Operations Command Centre (Future Module)

**Status: Deferred, not yet started.** Founder-recorded (2026-08-04), alongside
approval of the Driver Slice 2 freeze: the production audit's one outstanding
observation — real, permission-gated admin-side SOS/incident/support/shift
endpoints exist with no operations-console or admin-portal screen consuming
any of them yet — is not a Driver Slice 2 defect. It's the next module. This
document exists so that whoever scopes it starts from what's actually already
built (real backend, real permissions, real notification wiring) rather than
re-discovering it, the same way `DPX-DRIVER-005` preserves Slice 2's SOS
foundation for its own future response-workflow module.

## Founder's scope for this module

Recorded verbatim from the freeze-approval message, as the actual requirement
list this module needs to satisfy once scoped — not assumed or expanded here:

- Driver monitoring
- Live fleet overview
- SOS response
- Incident management
- Support ticket management
- Shift supervision
- Driver status
- Escalation workflows
- Dispatch oversight
- Operations dashboards

The founder's explicit framing: consolidate these into one Operations Command
Centre rather than scattering them across separate admin screens — a single
operational surface, not four unrelated admin pages bolted onto
`admin-portal`/`operations-console` independently.

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

## Why this is safe to defer

Driver Slice 2 was explicitly scoped as driver-facing capability — a driver
being able to report an incident, request help, manage their shift, and
trigger SOS. Whether Operations has a dedicated console to respond is a
distinct, real question that doesn't block any of those driver-facing
capabilities from being correct, real, and frozen on their own terms. Today,
the queues are reachable via direct API access; that's a genuine operational
gap for scale, not a defect in what Slice 2 was asked to build — the same
distinction the production audit itself drew.
