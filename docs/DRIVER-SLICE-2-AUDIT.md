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

### 1. Navigation — ⚠️ Partial, real gap is narrow

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

### 3. Shift management — ❌ Zero backend presence

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

### 4. Driver support — ❌ Zero general-purpose capability

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

### 5. Incident reporting — ❌ Zero capability, but real infra to build on

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

### 6. Driver help centre — ❌ Zero capability

`apps/driver-portal/src/app/learn/page.tsx` exists but is Driver Growth
Campaign educational/earnings content (`components/campaign`), not a
FAQ/help-article system. No CMS-backed help-content model scoped to
drivers exists — the platform's real `Cms` module (used for Marketplace)
could plausibly be reused (same content-management need, different
audience/category), rather than building a second CMS from scratch — a real
architecture question for whoever scopes this, not decided here.

### 7. Emergency/SOS — ❌ Zero capability

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

### 8. Communication tools (call/chat) — ❌ Zero capability, cheapest real win identified

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

### 10. Operational notifications — ⚠️ Partial, real taxonomy exists, driver-specific events don't

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

**Open decisions the founder needs to resolve before implementation
starts**, named honestly rather than assumed:

- Navigation: nav-app handoff only, or also build in-app voice guidance
  (a paid third-party SDK decision)?
- Shift management: does adherence tie into Driver Growth Campaign's tier
  system, or stay a standalone scheduling feature for now?
- Communication tools: `tel:` link only for v1, or commit to masked
  calling/chat (its own provider decision) as part of this slice?
- Emergency/SOS: does triggering it also auto-notify the driver's emergency
  contact and/or attempt to alert local authorities, or is v1 scoped to
  "alerts DrippleX operations" only?
- Driver profile enhancements: what's the concrete feature list?

This document deliberately stops at the audit + open-decisions stage — no
schema or service code has been written for Slice 2 yet, per the same
"design/audit before implementation" discipline applied to every other
slice in this project.
