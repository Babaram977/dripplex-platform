# DPX-OPS-001 — Operations Command Centre: Reality Audit & Phase 1 Build Plan

Founder-approved to open (2026-08-04), immediately after the Driver Slice 2 freeze.
Same discipline as every prior module: audit what's real before planning what to
build — no plan gets written against an assumed gap that turns out to already
exist, or an assumed capability that turns out not to. Founder's own instruction
for this module names an 11-step process; this document covers steps 1-4
(reality audit, Figma audit, backend capability audit, gap analysis) and
proposes a plan for step 5 (**founder review of the plan** — required before any
implementation begins).

**Update (2026-08-04): Slice 1 (Live Operations Dashboard) is now shipped** —
step 6 (implementation) and step 7 (verification) are complete for Slice 1.
See `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "Slice 1 — Live
Operations Dashboard" section for what was built.

**Update (2026-08-05): Slice 2 (Operations Work Queues) is now shipped** —
step 6 and step 7 are complete for Slice 2 too, under the founder's explicit
Slice 2 approval message. See
`docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "Slice 2 — Operations Work
Queues" section for what was built. Steps 8-11 (documentation, production
audit, founder approval, freeze) for the whole Phase 1 module happen once all
four slices are built, per the founder's own discipline — Slice 1+2 together
still aren't ready for a module-level production audit. Slices 3-4 (Dispatch
Management, Analytics) are not yet started.

**Update (2026-08-05, same day): Slice 2 refinement approved before the
Production Audit.** The founder resolved Slice 2's two initial capability
gaps: Date/Ride/Vehicle filters were added (Region deliberately deferred
until a canonical operational geography/zone model exists — not invented
here); the frozen `IncidentCategory` enum was explicitly left untouched
("Lost & found"/"Complaint escalation" become a future shared platform
support/incident capability, not a one-off addition for this console). The
founder also asked for the `OperationsCase` lazy get-or-create to be
stress-tested for multi-operator concurrency specifically — a real race
condition (duplicate CREATED timeline events under concurrent case
creation) was found and fixed as part of that request. See
`docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "Refinement (2026-08-05)"
subsection for the full detail.

**Update (2026-08-05, same day): Slice 2 Production Audit complete** — see
`docs/DPX-OPS-001-SLICE-2-PRODUCTION-AUDIT.md`. Found and fixed one real
defect (duplicate `CREATED` timeline events under concurrent lazy case
creation), verified filters/permissions/SLA/timeline/source-sync/frozen-
module-boundaries all real, and confirmed zero launch-blocking issues.

**Update (2026-08-05, same day): Slice 2 🔒 Founder Approved / Frozen.**
The founder reviewed the Production Audit and approved Slice 2 for freeze
— from this point Slice 2 accepts only critical defects/security fixes,
performance improvements, or explicitly founder-approved enhancements. See
`docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "🔒 Slice 2 — Founder
Approved / Frozen" subsection for the full freeze record. This is a
**slice-level** freeze, not the module-level one — steps 9-11's
module-level production audit + founder approval + freeze still happen
once all four Phase 1 slices are built, per the founder's own discipline.
Slice 3 (Dispatch Management) reality audit begins now, per the founder's
explicit instruction to audit before implementing — see
`docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md` once it exists. The founder's
standing boundary from `docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md`
carries forward unchanged into that audit: visibility into live rides/
assignment/nearby-drivers/ETA is in scope, mutating the frozen Ride
lifecycle is not, unless the audit identifies a genuinely minimal
interface need and that comes back for its own founder approval.

**Update (2026-08-05, same day): Slice 3 reality audit complete** — see
`docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md`. Re-verified every technical
claim DPX-RIDE-201 made against the current codebase (all held up, one
ETA-precision nuance worth stating plainly), confirmed Slice 1's ride queue
already covers "live ride queue" from the Dispatch Oversight list, and
found every remaining item (driver allocation via `RideOffer`, trip
monitoring via `RideTracking`, cancellation detail via `Ride`'s own
cancellation columns, the DPX-RIDE-201 decision-support panel) readable
today with zero changes to `apps/backend/src/rides/`. Manual reassignment
itself stays exactly where DPX-RIDE-201 left it — no activation, no
mutation. Submitted for founder review before implementation begins.

**Update (2026-08-05, same day): Slice 3 shipped** — founder approved the
audit's five-item scope in full; see
`docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "Slice 3 — Dispatch
Management" section for what was built and
`docs/DPX-OPS-001-SLICE-3-PRODUCTION-AUDIT.md` for the production audit.
`apps/backend/src/rides/` remains untouched; the "Reassign Driver" panel
ships with zero assignment action, exactly as `docs/DPX-RIDE-201-
OPERATIONS-MANUAL-DISPATCH.md` specifies.

**Update (2026-08-05, same day): DPX-OPS-001-FIGMA-PROTECTION-RULE.md
locked in** — a standing instruction, not scoped to any one slice: no
DPX-OPS-001 work may change the appearance of an existing Figma-derived
Ride/Marketplace/Wallet/Driver screen, and no Locked `packages/ui`
component may have its existing rendering changed to satisfy an
Operations Console need — new Operations-specific components, or
strictly additive/backward-compatible shared-component extensions, only.
Applies to Slice 4 and everything after it.

**Update (2026-08-05, same day): Slice 3 🔒 Founder Approved / Frozen** —
see `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`'s "🔒 Slice 3 —
Founder Approved / Frozen" subsection for the full freeze record. Same
slice-level discipline as Slice 2: from this point Slice 3 accepts only
critical security/defect fixes, performance/compliance work, or
explicitly Founder-approved enhancements. Manual reassignment stays the
deferred DPX-RIDE-201 action half. This is still a **slice-level** freeze
— steps 9-11's module-level production audit + founder approval + freeze
still wait on Slice 4. Slice 4 (Operations Analytics) reality audit
begins now, per the founder's own instruction to audit before
implementing — see `docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md` once it
exists. The founder's direction: keep analytics operational, not a
generic executive BI dashboard — audit what real data already exists for
fleet availability, driver utilization, shifts, ride demand/completion/
cancellation, dispatch performance, SOS/support/incident response times,
and geographic activity; don't invent metrics whose underlying timestamps
or events don't exist. The Figma Protection Rule applies to Slice 4 in
full.

**Update (2026-08-05, same day): Slice 4 reality audit complete** — see
`docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md`. Every named area checked
directly against the schema: driver utilization, shift analytics, ride
demand/completion/cancellation, dispatch performance (`RideOffer`), and
SOS/Incident/Support response times (`OperationsCase`, uniformly across
all three case types since Slice 2 built its SLA fields as a first-class
concern) are all fully real, no invented data needed. Fleet-availability
_trend_ and driver-position _movement_ trend are honestly ❌ — both data
points are stored as singleton, overwritten-in-place rows with no history
table, the same gap Slice 2's Live Activity Feed already found and
documented for driver online/offline events. Geographic ride-demand
heatmaps are real and historical (permanent lat/lng columns on every
`Ride` row); geographic driver-position data is real only as a live
snapshot, no history. No named regions, consistent with Slice 2's
standing deferral. The existing `apps/backend/src/analytics/` module
(Marketplace/Delivery-scoped, `recordMetric()` never actually called
anywhere) is explicitly **not** reused — wrong domain, dormant
infrastructure; Slice 4 builds its own live-query aggregation the same
way every prior slice has. Submitted for founder review before
implementation begins.

**Scope**: Phase 1 (Core Operations) only, per the founder's own phasing —
Fleet Operations, Emergency Operations, Support Centre, Incident Management,
Dispatch Oversight. Phase 2 (analytics, KPIs, heat maps, demand forecasting,
Marketplace/Wallet monitoring, fraud alerts, platform health) is named but
explicitly out of scope for this audit and this build.

## 1. App placement — `operations-console`, not `admin-portal`

Both apps exist today as identical login-only shells (`PortalAuthGate` +
`BackendStatusPanel`, nothing else — confirmed by reading both `app/page.tsx`
files directly). Neither has been meaningfully built out yet, so this is a
real decision, not a formality. Recommending `operations-console` based on
existing platform precedent, not a guess:

- `docs/DPX-013.md`'s own architecture note: "Ops reviewer opens case in
  `operations-console`" (merchant onboarding approval workflow).
- `OperationsInspectionsController` (`admin/inspections`, DPX-DRIVER-002
  Phase 3) is explicitly documented as living "within the existing
  Operations/Admin Portal, per the founder's decision not to build a
  separate Inspector app" — and the `operations_staff`/`inspection_officer`/
  `inspection_supervisor` roles that gate it are operational roles, not
  platform-administration roles.
- The `operations_staff` role (distinct from `administrator`/
  `super_administrator`) already holds every permission this module's Phase
  1 scope needs (§3) — it's the role this app is named for.

`admin-portal` is left as the home for platform-administration concerns
(user/role management, system configuration) — a different persona, not
touched by this module. **Flagging for explicit confirmation in founder
review, not assuming silently** — the precedent is strong but this is the
first module to actually build into either app, so it's worth a deliberate
yes rather than an inferred one.

## 2. Figma audit — N/A, confirmed

`docs/FIGMA-SOURCE-INVENTORY.md`: "Merchant/Admin/Ops — **Placeholder, no
screens**... `admin-portal`/`operations-console` are login-only" — no Figma
export exists for either app. Same status Driver Slice 1 and Slice 2 shipped
under. This module builds functionally, using `@dripplex/ui` primitives
directly, same as `apps/driver-portal` — re-platformed at a future DPX-100
pass, not blocked on one now.

## 3. Backend capability audit, per Phase 1 sub-area

Every row below was checked directly against `apps/backend/prisma/schema.prisma`,
the relevant service/controller files, and `role-permissions.ts` — not assumed.

### 3.1 Fleet Operations

| Capability                   | Status                                   | Evidence                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver online/offline status | ✅ Real                                  | `DriverAvailability.online`/`acceptingRides`, updated live by the driver-portal online toggle                                                                                                                                                                                                                                               |
| Live driver locations        | ⚠️ Data real, no ops-facing endpoint     | `DriverAvailability.latitude`/`longitude` updated live; the only existing consumer is `RideTrackingReadService.getNearbyDrivers()` — customer-facing, privacy-fuzzed to ~11m, capped at 20 results, filtered to one ride type near one point. **Not suitable for a fleet-wide ops view as-is; a new read-only endpoint is needed** (see §4) |
| Current trips                | ⚠️ Data real, no general ops-facing list | `Ride` table has everything; only consumer today is `AdminRideReportsController` (problem reports only, not a general active-rides list)                                                                                                                                                                                                    |
| Vehicle status               | ✅ Real                                  | `Vehicle`/`VehicleApprovalStatus`, `AdminDriverVehiclesController` (Slice 1)                                                                                                                                                                                                                                                                |
| Shift status                 | ✅ Real                                  | `DriverShift`, `AdminDriverShiftsController` (Slice 2) — list + force-end already built                                                                                                                                                                                                                                                     |
| Inspection status            | ✅ Real                                  | `Inspection`, `OperationsInspectionsController` (`admin/inspections`, DPX-DRIVER-002 Phase 3) — already the one existing example of an operations-console-intended endpoint                                                                                                                                                                 |

### 3.2 Emergency Operations

| Capability                 | Status          | Evidence                                                                                                                         |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Live SOS queue             | ✅ Real         | `SosAlertService`, `AdminSosAlertsController` (`admin/sos-alerts`, Slice 2) — list + acknowledge/resolve                         |
| Active emergency incidents | ✅ Real         | Same — `SosAlertStatus: OPEN → ACKNOWLEDGED → RESOLVED`                                                                          |
| Escalation workflow        | ❌ Missing      | Explicitly deferred — `docs/DPX-DRIVER-005-EMERGENCY-RESPONSE-WORKFLOW.md`, not built                                            |
| Incident timeline          | ❌ Missing      | Same document — `SosAlert.adminNotes` is a single free-text field, not an append-only timeline                                   |
| Dispatcher assignment      | ❌ Missing      | Same document — no `assignedTo` concept exists on `SosAlert`                                                                     |
| Resolution tracking        | ✅ Real (basic) | `resolvedAt`/`acknowledgedBy`/`acknowledgedAt` exist; no structured outcome taxonomy (e.g. `FALSE_ALARM` vs. genuinely resolved) |

### 3.3 Support Centre

| Capability               | Status     | Evidence                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver support tickets   | ✅ Real    | `DriverSupportTicket`, `AdminDriverSupportController` (Slice 2)                                                                                                                                                                                                             |
| Customer support tickets | ❌ Missing | **No general-purpose customer support ticket model exists anywhere in the schema.** `RideProblemReport` is ride-scoped only (a problem tied to one specific ride, reportable by either party via `reporterId`) — real, but not "a customer contacts support about anything" |
| Merchant support tickets | ❌ Missing | **No merchant support/complaint model exists anywhere.** Merchant-side operational concerns today route through KYC review (`admin:merchants:review`) or review moderation (`admin:reviews:moderate`) — neither is a support-ticket system                                  |
| Internal notes           | ⚠️ Partial | `DriverSupportTicket`/`IncidentReport`/`SosAlert` each have a single free-text notes-style field (not append-only, not per-note-authored) — same limitation named in §3.2                                                                                                   |
| Ticket assignment        | ❌ Missing | No `assignedTo` on any support/incident/SOS model                                                                                                                                                                                                                           |
| SLA monitoring           | ❌ Missing | No due-by/SLA-timer field on any model; would need to be computed client-side from `createdAt` + a policy constant, or added as a real field                                                                                                                                |

**This is the single largest gap in Phase 1** — a real, general-purpose
support-ticket system spanning customer and merchant (driver's already
exists) doesn't exist today. Scoping it is real, non-trivial backend work,
not a UI-only exercise like Fleet Operations mostly is.

### 3.4 Incident Management

| Capability             | Status                  | Evidence                                                                                                                                                                                                                       |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accident reports       | ✅ Real (as a category) | `IncidentReport` with `IncidentCategory.ACCIDENT`, `AdminIncidentReportsController` (Slice 2)                                                                                                                                  |
| Customer complaints    | ⚠️ Partial              | `RideProblemReport` (`RideProblemCategory.DRIVER_BEHAVIOUR`/`UNSAFE_DRIVING`) covers ride-scoped complaints; no general (non-ride-tied) customer complaint path exists                                                         |
| Driver misconduct      | ⚠️ Partial              | No dedicated category on either `IncidentCategory` or `RideProblemCategory` maps cleanly to "driver misconduct" reported by a customer — `RideProblemCategory.DRIVER_BEHAVIOUR` is the closest fit                             |
| Lost & found           | ⚠️ Partial              | `RideProblemCategory.LOST_ITEM` exists as a category on `RideProblemReport` — real, but no dedicated lost-and-found workflow (item description, matching, handoff/return tracking) beyond a single free-text description field |
| Vehicle issues         | ✅ Real (two paths)     | `RideProblemCategory.VEHICLE_ISSUE` (customer-reported, ride-scoped) and `IncidentCategory.VEHICLE_BREAKDOWN` (driver-reported) both exist                                                                                     |
| Investigation workflow | ❌ Missing              | No status beyond `OPEN`/`ACKNOWLEDGED`/`RESOLVED`-style enums on any of these models — no "under investigation," no evidence/attachment trail beyond photos already captured at creation                                       |

### 3.5 Dispatch Oversight

| Capability              | Status                    | Evidence                                                                                                                                                                                                  |
| ----------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live ride queue         | ❌ Missing                | No admin/ops endpoint lists active/in-progress rides at all — only `AdminRideReportsController` (problem reports, a different concern)                                                                    |
| Driver allocation       | ⚠️ Internal only          | `RideDispatchService.findNearestEligibleDriver` (`apps/backend/src/rides/`) does real matching — but it's an internal dispatch-flow method, not exposed as an ops-facing view of current allocation state |
| Manual reassignment     | ❌ Missing                | No endpoint exists to move an in-progress ride from one driver to another. **This is a write action into the frozen `rides/` domain** — see §4 for how this affects the plan                              |
| Trip monitoring         | ❌ Missing                | Same as "live ride queue" — the data (`Ride`, `RideTracking`) is real and complete, no ops-facing read endpoint exists                                                                                    |
| Cancellation monitoring | ⚠️ Data real, no ops view | `Ride.status = CANCELLED`, `RideCancelledBy` (`CUSTOMER`/`DRIVER`/`SYSTEM`) — real, queryable, no admin-facing list/filter exists                                                                         |

### 3.6 Permissions — mostly already seeded

`operations_staff` already holds every permission Phase 1's _existing_
backend capability needs: `admin:drivers:support-ticket:manage`,
`admin:drivers:incident-report:manage`, `admin:drivers:sos-alert:manage`,
`admin:drivers:shifts:manage`, `admin:drivers:vehicles:manage`,
`admin:inspection-centres:manage`, `inspection:checklist:manage`/
`inspection:approve`, `admin:rides:support`, `admin:drivers:review`. **No
new permission wiring is needed to consume what already exists** — the gap
is entirely UI (for what's real) and new backend capability (for what
isn't), not authorization.

## 4. Gap analysis — what Phase 1 actually requires to build

Grouped by how much new backend work each sub-area needs, since that's the
real driver of sequencing risk, not the UI itself:

1. **UI-only, real backend already complete**: Fleet Operations' shift/
   vehicle/inspection status, Emergency Operations' SOS queue, Support
   Centre's driver tickets, Incident Management's accident/vehicle-issue
   reports. This is the safest, fastest slice — no new Prisma models, no
   new migrations, no new permissions, purely consuming what Slice 1/2
   already shipped.
2. **New read-only backend work, no frozen-file changes needed**: Fleet
   Operations' live driver locations and current-trips list, Dispatch
   Oversight's live ride queue/trip/cancellation monitoring. All buildable
   as a new `apps/backend/src/operations/` module reading `DriverAvailability`/
   `Ride`/`RideOffer`/`RideTracking` directly via Prisma — the same
   established cross-module-read pattern `SosAlertService`/
   `DriverRideContactService`/`DriversService.getOwnPerformanceStats`
   already use. `rides/` itself is never modified.
3. **New backend models, real design work**: Support Centre's customer/
   merchant ticket systems (§3.3 — the single largest gap), Emergency
   Operations' escalation/dispatcher-assignment/timeline (already scoped in
   `DPX-DRIVER-005`, not yet built), Incident Management's investigation
   workflow and structured internal notes/SLA tracking. These need their
   own design pass, not a mechanical UI-wiring exercise.
4. **The one item that may need to touch frozen `rides/`**: Dispatch
   Oversight's manual reassignment is a _write_ into ride-lifecycle state —
   unlike every read-only case above, there's no way to reassign an active
   ride's driver without either calling into `RideDispatchService`/
   `RidesService` logic that lives in the frozen module, or duplicating
   that logic outside it (worse — two sources of truth for ride-lifecycle
   rules). Per the freeze policy, "explicit founder-approved enhancement"
   is one of the carve-outs that permits touching a frozen module — but
   this needs the founder's explicit call, not an assumption, before any
   code touches `apps/backend/src/rides/`.

## 5. Proposed Phase 1 build plan (for founder review — not yet approved)

Sequenced by the gap analysis above — real-backend-first, biggest design
questions surfaced early rather than late:

**Slice 1 — Fleet Operations + Emergency Operations + existing Support/
Incident queues** (UI-only + one new read-only backend module):

- New `apps/backend/src/operations/` module: `GET /operations/fleet` (live
  driver roster — online status, location, current trip if any, vehicle,
  active shift) and `GET /operations/rides` (live ride queue — active/
  in-progress rides with driver/customer/status), both read-only, both
  reading `DriverAvailability`/`Ride`/`RideShift`/`Vehicle`/`Inspection`
  directly.
- `operations-console` UI: a fleet map/list view, and list views for the
  three queues that already have real backend + admin permission (SOS,
  driver support tickets, incident reports) — the "what needs attention
  right now" screens the founder's guiding principle names directly.
- Shift/vehicle/inspection status folded into the fleet view rather than
  as separate screens, per "operational visibility" being about one
  driver's whole state at a glance.

**Slice 2 — Dispatch Oversight (read side)**:

- Trip monitoring, cancellation monitoring, live ride queue detail —
  extending Slice 1's `GET /operations/rides` with the filtering/detail
  the founder's list asks for.
- **Manual reassignment explicitly deferred to its own founder decision**
  (§4 point 4) — not silently built, not silently dropped.

**Slice 3 — Support Centre (new backend models)**:

- A real design pass for customer + merchant support tickets (its own
  reality-check of whether to generalize `DriverSupportTicket` into one
  polymorphic model or build siblings — a genuine design decision, not
  assumed here) before any schema work.

**Slice 4 — Incident Management workflow depth**:

- Investigation status, structured internal notes (moving off the
  single-free-text-field pattern), SLA fields — informed by whatever
  Slice 3's ticket-system design settles on, since these are the same
  underlying problem (structured status/notes/assignment) applied to a
  second set of models.

**Emergency Operations' escalation/dispatcher/timeline work
(`DPX-DRIVER-005`)** is not in this Phase 1 plan — it's already its own
named future document; folding it into DPX-OPS-001's Slice 1 SOS queue UI
only as much as the _existing_ `OPEN`/`ACKNOWLEDGED`/`RESOLVED` states
support, not pretending the fuller workflow exists.

Each slice gets the full discipline: implement → verify → document,
following the same per-item pattern Driver Slice 2 used, before moving to
the next. Production audit and founder approval happen once _Phase 1 in
full_ is complete, matching the founder's own step ordering (not per-slice
freezes the way Slice 2's items were — this module's "item" is Phase 1
itself).

## What this document is asking for

Per the founder's own step 5 ("Founder review of the plan"), no
implementation has started. This document is the plan for that review —
specifically:

1. Confirm `operations-console` as the target app (§1).
2. Confirm or adjust the Slice 1-4 sequencing above (§5).
3. **A decision on manual reassignment** (§4 point 4, §5 Slice 2) — build
   it as a founder-approved enhancement touching `rides/`, or defer it
   alongside the rest of Dispatch Oversight's harder pieces.
4. Any adjustment to scope before Slice 1 begins.

## Founder review — approved (2026-08-04)

The founder reviewed this plan and locked in the following decisions,
refining rather than simply accepting §1/§5 as originally proposed:

1. **App placement — approved as proposed**: `operations-console` is the
   permanent home for live operations (fleet monitoring, dispatch,
   incidents, SOS, support, shift monitoring, driver monitoring, real-time
   decisions). `admin-portal` is explicitly reserved for platform
   configuration (users & permissions, KYC approvals, pricing, CMS,
   promotions, system configuration, reports, audit logs) — a clean split
   the founder stated directly, not left to inference.
2. **Slice sequencing — refined**:
   - **Slice 1 — Live Operations Dashboard** (read-only): live drivers,
     driver status, vehicle status, inspection status, shift status, live
     ride queue, active trips, live KPIs — plus a **Live Fleet Map** as the
     first screen operators see (the founder's own framing: "the air
     traffic control screen for DrippleX"), showing driver locations
     categorized as available/busy/offline/SOS (highest priority)/needs
     inspection/suspended, plus current rides and unassigned ride requests.
   - **Slice 2 — Operations Work Queues**: SOS queue, Driver Support queue,
     Incident queue, accident reports, vehicle issue reports — answering
     "who needs help?"
   - **Slice 3 — Dispatch Management**: dispatch oversight, ride
     monitoring, driver allocation visibility, manual intervention tools —
     **with the "Reassign Driver" action itself deferred**, see point 3.
   - **Slice 4 — Analytics**: fleet performance, operations KPIs, heat
     maps, utilization, response times, shift analytics (this is Phase 1's
     own analytics slice, distinct from the broader Phase 2 named in the
     original module-open scope).
3. **Manual ride reassignment — visibility built now, action deferred**:
   Slice 3 ships a real "Reassign Driver" control showing eligible nearby
   drivers, availability, ETA, and ratings — but no reassignment action
   executes. Recorded as `docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md`,
   a founder-approved-enhancement-in-principle that reopens the frozen Ride
   module later, once specifically scoped and re-approved.
4. **Support Centre — architecture only, no invented systems**: do not
   build customer/merchant support ticket systems inside DPX-OPS-001.
   Driver Support (already real) is the only live queue in Phase 1;
   support is expected to evolve into a shared platform ticket engine
   (Driver/Customer/Merchant/Vendor/Courier Support, audience-specific
   workflows on one common engine) — Phase 1's job is to keep
   `DriverSupportTicket`'s architecture pluggable into that later, not to
   build the other audiences' systems now.

**Founder's operations philosophy, recorded as the standing design test for
every screen this module ships**: every screen must answer one of —
"What is happening now?", "What needs attention now?", "What action should
Operations take now?" If a screen can't answer one of those three, it
belongs in `admin-portal`, not here.

Implementation (step 6) begins with Slice 1.
