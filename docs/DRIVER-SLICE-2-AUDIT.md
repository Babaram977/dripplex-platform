# Driver Slice 2 — Reality Audit

Same discipline as `RIDE-001A` and the original `DRIVER-APP-DPX-100-AUDIT.md`:
check what's real before planning what to build. Founder-approved scope
(2026-08-04, with shift management folded in the same day): Navigation, Trip
execution, Shift management, Driver support, Incident reporting, Driver help
centre, Emergency/SOS, Communication tools (call/chat), Driver profile
enhancements, Operational notifications.

Scope checked: `apps/driver-portal`, `apps/backend/src/{rides,drivers,
notification-center,notifications}`, every schema model touching these
domains, and the existing driver Growth Campaign UI (`components/campaign`,
`app/learn`) for anything reusable.

## Per-item reality check

### 1. Navigation — ✅ Nav-app handoff shipped (2026-08-04)

**Built:** `apps/driver-portal/src/lib/maps.ts` (`buildGoogleMapsUrl` /
`buildAppleMapsUrl` / `buildWazeUrl` / `buildNavAppOptions`) plus a new
`NavigateButton` component (`components/ride/navigate-button.tsx`) — a
`DropdownMenu`-based 3-option picker (Google Maps / Apple Maps / Waze),
each a zero-setup universal link opened in a new tab. Wired into
`app/trip/page.tsx` in both `AssignedSection` (navigate to pickup) and
`InProgressSection` (navigate to dropoff), replacing the single hardcoded
Google Maps anchor. In-app voice guidance remains deferred per the
founder's decision below — nav-app handoff only for v1.

Original audit finding, kept for context:

**Real today:** `apps/driver-portal/src/components/ride/live-map.tsx` +
`map-canvas.tsx` (MAPS-UI Slice 3) render a real Google-Maps-backed route
between the driver and pickup/dropoff, with real ETA (`sdk` Directions
integration, same pattern as customer-web). The driver trip page
(`app/trip/page.tsx`, Launch Mode Slice 3) already shows this live during an
active trip.

**Missing:** voice guidance (turn-by-turn audio) and nav-app handoff
(deep-linking to Google Maps/Waze for drivers who prefer their own nav app)
— neither exists anywhere. Nav-app handoff is a small, real, well-scoped
addition (a `google.navigation:q=lat,lng` / `https://maps.google.com/maps?daddr=`
intent link, platform-aware); voice guidance would mean either embedding a
turn-by-turn SDK (bigger lift, a real third-party choice — Google's own
Navigation SDK is a paid, separately-licensed product from the Directions
API already in use) or leaning on nav-app handoff entirely and not building
in-app voice guidance at all. **Real scoping decision, not assumed here.**

### 2. Trip execution — ✅ Already substantially real

**Real today:** the entire offer→accept→arrive→start→complete lifecycle
(`RideTripService`, RIDE-002.6), the GPS-proximity gate on Start Ride
(RIDE-002.10), driver-side dispatch via `RideGateway` (WebSocket,
RIDE-002.5), the driver trip page and incoming-ride modal (Launch Mode
Slices 2-3), fare/earnings display, customer rating capture. This is not a
gap — Slice 2 doesn't need new backend work here. What's still open is only
the DPX-100 UI port (Slice 3 below), not new capability.

### 3. Shift management — ✅ Shipped (2026-08-04)

**Built:** exactly the founder's scope, plus the safety-tracking addition
made when approving item 5 (SOS). Two new models
(`apps/backend/src/drivers/shifts/`): `DriverShift` (status —
ACTIVE/ON_BREAK/ENDED — startedAt/endedAt, breakStartedAt,
`continuousSince` — reset every time a break ends or the shift starts, the
basis for the continuous-driving figure below — totalBreakSeconds,
forceEndedBy/adminNotes for Operations cleanup) and
`DriverPlannedAvailability` (dayOfWeek + startMinute/endMinute — a
recurring weekly window, informational for Operations staffing visibility
only). Deliberately independent of `DriverAvailability.online` (the frozen
Ride module's real-time dispatch flag) — a shift is a separate
driver-initiated work-session concept for v1, not wired to it; likewise
`DriverPlannedAvailability` does **not** automatically toggle that flag
(an automation decision deliberately not made here).

`DriverShiftService` enforces at most one open (ACTIVE/ON_BREAK) shift per
driver at a time (service-layer check, no DB constraint) and exposes
`getSummary()` — advisory-only safety figures, nothing here blocks a
shift/break transition or a ride: continuous driving minutes, total
minutes worked today, and three boolean flags (`breakReminderDue` at 240
continuous minutes, `fatigueWarning` at 300, `dailyLimitExceeded` at 720
minutes/day — plain constants in `driver.constants.ts`, not yet
admin-configurable like `DriverSecuritySettings`). The fatigue warning is
surfaced via this summary endpoint only — it is **not** enforced at the
Ride module's offer-accept step, since that would mean touching frozen
`rides/` files; the driver-portal surfaces it to the driver, nothing
blocks automatically, per the founder's explicit "doesn't have to block a
driver automatically" guidance.

Driver endpoints: `POST /driver/shifts/{start,end}`,
`POST /driver/shifts/break/{start,end}`, `GET /driver/shifts/summary`,
`GET /driver/shifts` (own history); `GET/POST /driver/planned-availability`,
`DELETE /driver/planned-availability/:id`. Admin (operations visibility):
`GET /admin/driver-shifts` (filter by status/driverId),
`PATCH /admin/driver-shifts/:id/end` (force-end an abandoned/stuck shift),
`GET /admin/driver-planned-availability?driverId=`. Admin queues are
backend-only for now — no operations-console page yet, same scope choice
as items 3-5. New permissions `driver:shift:manage` /
`admin:drivers:shifts:manage`. Driver-portal `/shift` page: Start/End
Shift and break-mode controls, live continuous-driving/today's-total
figures (polled), non-blocking safety banners, a simple weekly
planned-availability editor, and shift history. Extension points
preserved so the Driver Growth Campaign can consume shift data later
without a redesign — deliberately not wired to campaign tiers now, per
the founder's decision.

Original audit finding, kept for context:

No `shift` concept anywhere in the schema, services, or driver-portal.
`DriverAvailability` (real, Ride module) is a live online/offline toggle,
not planned availability windows — a driver going online today has no way
to say "I plan to work Tuesday 6am-2pm" in advance. Needs, from scratch:

- A `DriverShift`-shaped model (driver, planned start/end, status
  — scheduled/active/completed/missed/cancelled — real fields, not
  invented here beyond naming the shape).
- A service for CRUD + a "did the driver actually go online during their
  shift window" reconciliation (real signal: cross-reference
  `DriverAvailability` transitions against `DriverShift` windows).
- Whether shift adherence ties into Driver Growth Campaign's existing tier
  system (the founder's own earlier suggestion) is a real product decision,
  not assumed here — that system (`DriverCampaignService`) has its own
  qualification/tier logic that this would need to integrate with
  deliberately, not bolt on.

### 4. Driver support — ✅ Ticket queue shipped (2026-08-04)

**Built:** `DriverSupportTicket` (schema: category — PAYOUT/ACCOUNT/APP_BUG/
KYC/OTHER — subject, description, status — OPEN/IN_PROGRESS/RESOLVED/
CLOSED — adminResponse, resolvedBy/resolvedAt) plus `DriverSupportService`
(`apps/backend/src/drivers/support/`), driver-facing
`DriverSupportController` (`POST`/`GET /driver/support-tickets`) and admin
`AdminDriverSupportController` (`GET`/`PATCH /admin/driver-support-tickets`)
— exactly the scoped "submit an issue, admin sees a queue" v1 the audit
called for, not a full helpdesk platform. Any admin status/response change
notifies the driver in-app via `NotificationCenterService` (new
`DRIVER_SUPPORT_TICKET_UPDATED` type, `SUPPORT` category). Driver-portal
`/support` page: create-ticket form + own-ticket list showing admin
responses. Permissions: `driver:support-ticket:manage` (driver role),
`admin:drivers:support-ticket:manage` (operations_staff/administrator/
super_administrator).

Original audit finding, kept for context:

**Real today:** `RideProblemReport` (`ride-problem-report.service.ts`,
RIDE-002.8) — but this is strictly ride-scoped ("Report an Issue" on a
specific completed trip), reachable only from Trip Receipt/Report Trip
screens. There is no general "I have a problem, not tied to a specific
ride" support-ticket concept for drivers (payout disputes, account issues,
app bugs, KYC questions).

**Missing:** a real ticket/help-request model + submission flow + admin
queue. The original audit doc's earlier note still holds: "a basic 'submit
an issue, admin sees a queue' loop is a defensible v1, not a full helpdesk
platform" — a real, deliberately-scoped-down v1, not a gap to over-build.

### 5. Incident reporting — ✅ Shipped (2026-08-04)

**Built:** `IncidentReport` (schema: category — ACCIDENT/
PASSENGER_ALTERCATION/VEHICLE_BREAKDOWN/SAFETY_CONCERN/OTHER — severity —
LOW/MEDIUM/HIGH/CRITICAL — description, optional latitude/longitude,
optional `rideId`, status — OPEN/ACKNOWLEDGED/RESOLVED — adminNotes,
acknowledgedBy/acknowledgedAt, resolvedAt) plus `IncidentReportService`
(`apps/backend/src/drivers/incidents/`), driver-facing
`DriverIncidentReportsController` and admin `AdminIncidentReportsController`
(queue sorted severity-then-recency). Now fires into the
`NotificationCategory.EMERGENCY` taxonomy this section's original finding
noted was modeled but unused — new `INCIDENT_REPORT_UPDATED` type, driver
notified on acknowledge/resolve. `rideId` is deliberately a plain id with no
Prisma relation to `Ride` (see the schema doc comment) — respects the
frozen Ride module without needing a back-relation field on it.
Driver-portal `/incident` page auto-attaches the driver's active ride (if
any) and current GPS location. Also now provides the capability
`docs/DPX-DRIVER-004-VEHICLE-APPROVAL-LIFECYCLE-POLICY.md` flagged as a
prerequisite for its own "vehicle-changed"/"safety complaint" re-inspection
triggers — that document's own follow-through is still deferred, unchanged
here.

Original audit finding, kept for context:

Distinct from "Driver support" above — this is safety-relevant (an
accident, a passenger altercation, a vehicle breakdown mid-trip), not a
general complaint. Nothing today lets a driver flag "something happened on
this trip beyond a normal problem report." `NotificationCategory` already
has a real `SUPPORT`/`EMERGENCY`/`SYSTEM` taxonomy in
`packages/types/src/platform/index.ts` — modeled but never fired into for
this purpose, since no domain event exists yet to trigger it. Also directly
relevant to `docs/DPX-DRIVER-004-VEHICLE-APPROVAL-LIFECYCLE-POLICY.md`'s
"vehicle-changed" and "safety complaint" re-inspection triggers, which that
document already flagged as needing this same capability to exist first.

### 6. Driver help centre — ✅ Shipped (2026-08-04)

**Built:** exactly the reuse path this section itself suggested, confirmed
by the founder when this item's scope was resolved (it was the one item
outside the founder's original five decisions — see the founder-decisions
section below). No new content system: two new `CmsContentType` values,
`DRIVER_FAQ` (`body: { question, answer, category? }`) and
`DRIVER_STATIC_PAGE` (`body: { text }`), on the existing `CmsContent`
model. Authoring uses the existing `AdminCmsController`
(`admin:cms:manage`) unchanged — no new admin controller, no new admin
permission. `CmsService` gained `getPublishedDriverHelp()` (lists
published driver-scoped content) and had `getPublishedPageBySlug()`'s
allowed-types list extended to include the two new types, so a single
FAQ/article can also be fetched by slug. New driver-facing
`DriverHelpController` (`GET /driver/help`, `GET /driver/help/:slug`),
gated by a new read-only `driver:help:read` permission (seeded for the
driver role only — no admin-role change needed). Driver-portal `/help`
page: FAQ entries grouped by category as an expandable list (native
`<details>`, no new dependency), full articles as plain-text cards;
content the page doesn't recognize (a malformed `body`) is skipped
silently rather than crashing — an honest gap, not a guess at rendering
arbitrary JSON. Nav link added.

Original audit finding, kept for context:

`apps/driver-portal/src/app/learn/page.tsx` exists but is Driver Growth
Campaign educational/earnings content (`components/campaign`), not a
FAQ/help-article system. No CMS-backed help-content model scoped to
drivers exists — the platform's real `Cms` module (used for Marketplace)
could plausibly be reused (same content-management need, different
audience/category), rather than building a second CMS from scratch — a real
architecture question for whoever scopes this, not decided here.

### 7. Emergency/SOS — ✅ DrippleX Operations SOS shipped (2026-08-04)

**Built:** exactly the founder's decision above, no more. A new `SosAlert`
model (`apps/backend/src/drivers/sos/`) with a plain `rideId`/`vehicleId`
(no Prisma relation to `Ride`/`Vehicle` back into the frozen modules —
`vehicleId` does carry a real FK to `Vehicle` since Slice 1 is a sibling,
non-Ride-frozen model, but `rideId` stays a scalar id per the same
pattern already used for `IncidentReport`). `SosAlertService.trigger()` is
zero-friction by design: the driver's request never carries `rideId` or
`vehicleId` — the backend auto-resolves the driver's active ride
(`DRIVER_ASSIGNED`/`ARRIVED`/`IN_PROGRESS`, same query as
`DriverRideContactService`) and their approved+active `Vehicle` server-side,
so a single tap can't be spoofed to a ride/vehicle that isn't genuinely
theirs. On trigger: a durable `SosAlert` row is created first (so the alert
exists even if no one is listening for the push), then every user holding
`admin:drivers:sos-alert:manage` is broadcast a `CRITICAL`-priority
in-app/push notification via `NotificationCenterService.broadcast()` (the
real Firebase push wiring from DPX-CORE-001 Phase D — chosen over building
a new WebSocket gateway with no operations-console consumer to test
against), and — only if the driver has an active ride — the ride's
customer is separately sent a `HIGH`-priority notice that assistance was
requested (`customerNotifiedAt` recorded). Admin `PATCH` acknowledges/
resolves and notifies the driver back, same shape as Incident Reporting's
admin queue. Exposed as `GET/POST /driver/sos-alerts`,
`GET /driver/sos-alerts/:id`, and `GET/PATCH /admin/sos-alerts` (admin
queue is backend-only for now — no operations-console page exists yet, per
the same scope choice made for items 3-4). Driver-portal ships a dedicated
`/sos` page: a large red button armed by a first tap and sent by a second
tap within 5 seconds (guards against an accidental single tap while
staying a true one-hand, no-typing action), a live battery-level reading
via the browser's Battery Status API when available (honestly `null`
otherwise — that API is deprecated/unsupported in most browsers today),
and a history list of the driver's own past alerts with any ops notes.
**Explicitly not built, per the founder's decision:** automatic contact to
emergency services or the driver's emergency contact — deferred pending
country-specific legal/operational policy.

Original audit finding, kept for context:

The only "emergency" hits anywhere in the backend are
`DriverProfile.emergencyContactName`/`emergencyContactPhone`
(DPX-DRIVER-002 Phase 1) — a contact record collected at onboarding, not an
active SOS trigger. No "driver presses a button mid-trip, ops gets alerted
in real time" capability exists. This is the highest-stakes item in this
slice (real passenger/driver safety implications) and should not be
under-scoped: at minimum needs a real-time alert path to
operations-console (the existing `RideGateway` WebSocket infra is the
natural extension point, same as Ride's dispatch), a durable audit record
(not just a push notification that can be missed), and a decision on
whether it also auto-notifies the emergency contact and/or local
authorities — the last of which is a real policy question, not a technical
one, and shouldn't be assumed silently either way.

### 8. Communication tools (call/chat) — ✅ One-tap calling shipped (2026-08-04)

**Built:** plain `tel:` calling only, per the founder's decision — no masked
calling, no chat. Correction to this section's original finding below: the
phone number was **not** already on `RideDto` (`RideDto` never carried
customer contact info to the driver at all — see `PassengerCard`'s honest
gap notice, which predates this fix). Closed via a new, read-only
`DriverRideContactService` (`apps/backend/src/drivers/ride-contact/`) that
resolves the customer's name/phone for whichever ride is currently
`DRIVER_ASSIGNED`/`ARRIVED`/`IN_PROGRESS` for the calling driver, reading
`Ride`/`User` directly via Prisma — deliberately placed under `drivers/`,
not `rides/`, since the Ride module is frozen; this is the same
cross-module read pattern wallet/notifications already use. Exposed via
`GET /driver/ride-contact/active` (reuses `RIDE_PERMISSIONS.DRIVER_MANAGE`)
and wired into `PassengerCard` as a call button when a phone number is on
file, with an honest "no phone on file" state when it isn't.

Original audit finding, kept for context:

No telephony/masked-calling integration exists anywhere in the platform
(Twilio is wired for SMS only, not voice) and no `tel:` deep link exists
anywhere in `customer-web` or `driver-portal` — confirmed by grep, not
assumed. This matches the already-documented gap in `MATURITY.md`'s Ride
Tracking screen ("Call/Message... shown but disabled, since no
telephony/chat capability exists anywhere in the backend").

Two very different scopes hide under "Communication tools," and this needs
an explicit decision before build starts:

- **Cheapest real option:** a plain `tel:` link to the counterpart's real
  phone number (already on `RideDto`/`DriverProfileDto`) — no new backend
  capability at all, just wiring up what already exists. Exposes real phone
  numbers directly (a privacy tradeoff worth naming, not hiding).
- **Masked calling / in-app chat:** a real third-party integration (Twilio
  Voice proxy numbers, or a chat SDK) — meaningfully bigger scope, its own
  provider decision (same class as Smile ID/background-check choices), and
  ongoing cost.

### 9. Driver profile enhancements — ⚠️ Undefined scope

`DriverProfile`/`User` already carry real fields (name, phone, email,
emergency contact — DPX-DRIVER-002 — KYC documents, vehicle records).
"Enhancements" isn't itself a scoped requirement — the founder's message
names it as a slice item without specifics. Needs a concrete list (e.g.
profile photo management, language/locale preference, notification
preferences UI, vehicle-switching for multi-vehicle drivers) before this
can be estimated or built; assumed to mean driver-portal UI for viewing/
editing what already exists in the backend, at minimum.

### 10. Operational notifications — ✅ Shipped (2026-08-04)

**Built:** confirms this section's own framing — it wasn't independently
buildable, and shipped incrementally with each item as predicted.
Support-ticket status updates (`DRIVER_SUPPORT_TICKET_UPDATED`,
item 4/originally numbered 3) and incident-report acknowledgement
(`INCIDENT_REPORT_UPDATED`, item 3/originally numbered 4 — see those
items' own shipped blocks) fire from inside their services on every admin
status change. SOS-alert confirmations (`SOS_ALERT_TRIGGERED` broadcast to
Operations, `SOS_ALERT_CUSTOMER_NOTICE` to the ride's customer,
`SOS_ALERT_UPDATED` to the driver on ack/resolve) shipped with item 5. The
one piece genuinely gated on this item existing on its own — shift
reminders — is the new `DriverShiftReminderSweepService`
(`apps/backend/src/drivers/shifts/`): a plain-`setInterval` sweep (same
pattern as `RideOfferSweepService`/`PromotionSweepService`, no
`@nestjs/schedule` dependency in this codebase) polling open shifts every
5 minutes against `DriverShiftService.getSummary()` — the exact same
advisory computation the driver-portal `/shift` page already polls — and
firing `SHIFT_BREAK_REMINDER`/`SHIFT_FATIGUE_WARNING`/
`SHIFT_DAILY_LIMIT_EXCEEDED` push notifications once per threshold
crossing (tracked via new `breakReminderSentAt`/`fatigueWarningSentAt`/
`dailyLimitNotifiedAt` fields on `DriverShift`, cleared when a break ends
so a fresh continuous stretch can earn its own reminder). Purely
advisory — this sweep only sends notifications, exactly like the
`getSummary()` flags it's built on, it never blocks a shift, a break, or
a ride.

Original audit finding, kept for context:

Real, working infra: `NotificationCategory`/`NotificationType`/
`NotificationChannel`/`NotificationPriority` (DPX-CORE-001/DPX-CORE-001
Phase 1), Firebase push wired, the notification-center subscriber pattern
already fires real events for Marketplace/Ride/Wallet. What's missing is
driver-operations-specific event wiring: shift reminders, incident-report
acknowledgement, support-ticket status updates, SOS-alert confirmations —
none of which can be built until items 3-5 and 7 above have real domain
events to hang notifications off of. This item isn't independently
buildable; it's the notification layer for the other new capability in
this slice, not a separate system.

## What this means for the slice plan

Nine of the ten items are either already real (Trip execution), a narrow
well-scoped addition (Navigation's nav-app handoff), or genuinely new
backend systems with real open decisions the founder needs to make before a
build plan can be written (Shift management, Support, Incident reporting,
Help centre, SOS, Communication tools). Operational notifications rides
along with whichever of those ship. Profile enhancements needs a concrete
requirements list.

**Recommended build order**, sequencing lower-risk/higher-value items
first and grouping genuinely related work rather than building ten
disconnected features in an arbitrary order:

1. Navigation's nav-app handoff (small, no open questions, ships fast).
2. Communication tools' cheapest option (`tel:` link) — same profile:
   small, real, no new backend capability, immediate driver value. Masked
   calling/chat deferred pending the provider decision named above.
3. Driver support (ticket model + admin queue) and Incident reporting
   together — closely related (both are "driver flags something, ops
   sees a queue"), sharing a real data model and admin-console surface
   makes more sense than building two near-duplicate systems.
4. Emergency/SOS — highest stakes, deserves its own focused pass once the
   support/incident foundation above exists to build on (reuses the same
   ops-queue pattern, adds the real-time alert layer).
5. Shift management — independent of the above, can run in parallel once
   the founder resolves the Driver Growth Campaign tier-integration
   question.
6. Driver help centre — lowest urgency of the net-new items; likely reuses
   the existing `Cms` module rather than being genuinely new work, once
   scoped.
7. Driver profile enhancements — needs its concrete list before it can be
   sequenced at all.
8. Operational notifications — wired incrementally alongside 3-6, not a
   separate phase.

## Founder decisions (2026-08-04)

All five open decisions resolved the same day, explicitly not blocking the
items that don't need them:

1. **Navigation — nav-app handoff only.** Google Maps, Apple Maps, Waze (if
   installed). In-app voice guidance explicitly deferred — SDK
   cost/licensing/maintenance not justified pre-launch; professional
   drivers already carry a preferred nav app.
2. **Shift management — standalone first, integrate later.** Start Shift,
   End Shift, planned availability, scheduled online/offline, break mode,
   daily working hours, operations visibility. Extension points preserved
   so Driver Growth Campaign can consume shift data later without a
   redesign — not wired to campaign tiers now.
3. **Communication — plain phone calling (`tel:`) for v1 only.** One-tap
   call. No masked calling — real telecom-provider/call-routing/
   recording/privacy/cost implications, deferred to a later milestone. An
   in-app messaging _placeholder_ is only wired if the messaging backend
   already exists (it doesn't, per the audit above — so v1 ships call-only,
   no placeholder UI for a backend that isn't there).
4. **SOS — DrippleX Operations only, v1.** Pressing SOS sends an immediate
   alert to Operations with driver ID, current GPS, active trip, timestamp,
   vehicle, and battery level (if available); the customer (if on an active
   trip) is notified that assistance has been requested. **Explicitly not
   built in v1:** automatic contact to emergency services or the driver's
   emergency contact — those require country-specific legal/operational
   policy the founder is deliberately not deciding here.
5. **Profile enhancements — scoped now**, to the field list below.
   Regulated fields require a review workflow, never direct driver edit.

**Viewable/editable directly by the driver:** personal information, profile
photo, emergency contact, languages spoken, preferred service areas,
driving experience, vehicle information (display; edits go through the
existing `VehiclesService` approval workflow, not a raw field edit),
documents overview, inspection history, performance statistics, ratings
summary, earnings summary, security status, account status.

**Regulated — view-only, review-workflow required to change, never a
direct driver edit:** NIN, BVN (neither exists in the schema yet — no
regression here, just confirming they'd land behind this same rule once
DPX-DRIVER-002's NIN/BVN follow-up ships), driver licence (routes through
the existing `DriversService.submitKyc`/admin-verify flow, not a
self-service field), vehicle approval status, inspection status.

## Execution order (founder-directed, 2026-08-04)

1. Navigation handoff
2. One-tap phone calling
3. Driver Support
4. Incident Reporting
5. SOS
6. Shift Management
7. Help Centre
8. Operational Notifications
9. Profile Enhancements
10. Slice 2 production audit
11. Founder review
12. Freeze

This supersedes this document's own earlier "recommended build order"
above where the two differ (the founder's order runs Support/Incident/SOS
before Shift Management; the earlier recommendation had Shift Management
running in parallel) — the founder's explicit order is authoritative.
Implementation proceeds item by item below, each verified (typecheck/lint/
test) before moving to the next, per this project's standing discipline.
