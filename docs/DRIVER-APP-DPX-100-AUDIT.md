# Driver App — Reality Audit & Slice Plan

Kickoff document for the Driver App module, next in the founder's ordering after Ride,
Marketplace, and Wallet were frozen. Same discipline as `RIDE-001A` and the Marketplace/
Wallet module starts: audit what's real before planning what to build — no slice plan
gets written against an assumed gap that turns out to already exist.

Scope checked: `apps/driver-portal` (existing, pre-DPX-100 app), `apps/backend/src/drivers/`,
and every schema model/enum touching driver data. Founder's stated priority list for this
module: driver onboarding, facial verification, vehicle management, earnings dashboard,
shift management, availability, navigation, ratings, wallet, support.

## What already exists (real, not this task's job to rebuild)

`apps/driver-portal` is a working Next.js app (built across the Driver Growth Campaign
and Launch Mode passes) with real screens for: dashboard/incoming-ride handling
(`page.tsx`, `incoming-ride-modal.tsx`, `online-toggle-card.tsx`), active trip
(`trip/page.tsx`, `active-trip-summary-card.tsx`, `live-map.tsx`), ride history
(`history/page.tsx`), earnings (`earnings/page.tsx`, `dashboard-stats-card.tsx`), wallet
(`wallet/page.tsx`), profile + KYC document submission (`profile/page.tsx`,
`kyc-document-form.tsx`), ratings (`ride-ratings-display.tsx`, `customer-rating-form.tsx`),
and a full referral/growth-campaign surface (`campaign/`, `leaderboard/`, `learn/`,
`rewards/`). None of this has gone through the DPX-100 `packages/ui/super-app` port yet
— it's real and shipped, using its own component library, the same status Ride and
Merchant had before their own DPX-100 passes.

Backend-side, per priority item:

| Priority item                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Availability (online/offline) | ✅ Real — `DriverAvailability` model (online, acceptingRides, location, vehicleType), `driver-portal`'s `online-toggle-card.tsx`, dispatch-integrated since RIDE-002.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Earnings dashboard            | ✅ Real — ride settlement/commission split (RIDE-002.7), driver wallet access, `earnings/page.tsx`, Launch Mode Slice 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Ratings                       | ✅ Real — passenger↔driver ratings (RIDE-002.8), `ride-ratings-display.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Wallet                        | ✅ Real — driver wallet permission + endpoints (RIDE-002.7), `wallet/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Navigation                    | ⚠️ Partial — `live-map.tsx` uses real Google Directions for pickup/dropoff routing when `GOOGLE_MAPS_API_KEY` is configured (MAPS-UI Slice 3); no turn-by-turn voice guidance or external nav-app handoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Driver onboarding             | ⚠️ Partial — `DriverProfile`/`DriverOnboarding`/`DriverKyc` models real; admin approve/reject/suspend workflow real (`admin-drivers.controller.ts`); driver-facing side is one generic document-upload endpoint (`POST /driver/kyc`), not a structured multi-step flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Vehicle management            | ❌ Missing — no `Vehicle` model. `VEHICLE_REGISTRATION` exists only as a `KycDocumentType` (an uploaded document, not structured data), and `DriverAvailability.vehicleType` is a single enum field (ride category), not a registered vehicle (plate, make, model, color, year) a driver can view/edit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Facial verification           | ✅ Backend real, UI deferred (DPX-DS-001 / DPX-DRIVER-001) — provider-agnostic risk engine (9 priority-ordered triggers: onboarding, first-login-of-day, idle timeout, new device, GPS anomaly, suspicious activity, random spot-check, credential change, failed-login lockout, plus manual admin), `SmileIdProvider` (real request signing, environment-blocked on live credentials only), admin-configurable lockout/GPS/spot-check thresholds and feature toggles (`DriverSecuritySettings`, no redeploy needed), full audit trail (`DriverIdentityVerification`, including session ID). Per DrippleX's Figma-first process, no capture/verification-required screen was built — driver-portal only sends the signals the risk engine needs; the actual UI ships when the Driver module's Figma designs are ported. See `docs/DPX-DRIVER-001-SECURITY-STANDARD.md` (authoritative, locked), `docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md`, and `docs/DPX-900-DRIVER-SECURITY-TRUST.md`. Not to be confused with the Figma auth flow's "biometric" screen (device Face ID/Touch ID app-unlock via WebAuthn — a different, already-documented gap in Wallet Security) |
| Shift management              | ❌ Missing entirely — no scheduling/shift-target model or endpoint anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Support                       | ❌ Missing entirely — no ticket/help-request model or endpoint anywhere in the platform, for any portal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Facial verification provider — resolved

**Was the one blocking decision; now closed.** Smile ID was chosen (the founder's
direction, matching this doc's earlier recommendation of it as the dominant
Nigeria-specific identity-verification vendor). Built as DRIVER-001 / DPX-DS-001 /
DPX-DRIVER-001 — see the table above and `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`
(authoritative, founder-locked).

## DPX-DRIVER-002's open items — resolved (2026-08-04)

Per `docs/DPX-DRIVER-002-INSPECTION-STANDARD.md` (founder-approved design), driver
onboarding is being upgraded from digital-KYC-only to a four-phase flow that
includes mandatory physical vehicle/driver inspection. Its two blocking decisions
were resolved the same day it was approved:

- **Criminal/watchlist-check provider** — deferred to
  `docs/DPX-DRIVER-003-BACKGROUND-SCREENING.md` (future milestone). Not blocking
  Slice 1; extension points are preserved so it can be added later without
  restructuring onboarding.
- **Inspection management** — lives in `operations-console` (no separate inspector
  app), via new `inspection_officer`/`inspection_supervisor` roles plus the
  existing `operations_staff` role for the "Operations Manager" tier. Backend
  capability only for this pass — the actual Inspection section UI is Figma-first,
  same as the rest of Driver.

Still genuinely open, not blocking Slice 1: **NIN/BVN provider** — Smile ID's
Nigeria-specific products are the likely candidate given it's already integrated,
but that's a recommendation, not a decision made here.

**Slice 1 (onboarding, vehicle management, inspection engine) — 🔒 Frozen,
founder-approved (2026-08-04).** All three pieces are real, tested, DB-backed
capability:
`VehiclesService` (driver CRUD + admin approve/reject, plate uniqueness,
re-review-on-material-change), `OnboardingService` (repurposes the previously
vestigial `DriverOnboarding` model for emergency contact, agreement
acceptance, and a validated submit-for-review step), and the inspection
engine (`InspectionCentresService`, `InspectionsService` — appointment
booking, officer-records/supervisor-decides checklist workflow, re-inspection
scheduling, and a passed inspection auto-approving its vehicle). Endpoints
live under `driver/vehicles`, `driver/onboarding`, `driver/inspections`
(driver-facing) and `admin/vehicles`, `admin/inspection-centres`,
`admin/inspections` (operations-console-facing, gated by the new
`inspection_officer`/`inspection_supervisor` roles plus the existing
`operations_staff`/`administrator`/`super_administrator`). SDK clients exist
for all of it.

**Unified activation gate — also real (2026-08-04).** The founder correctly
flagged that shipping KYC/vehicle/inspection/agreement as four independently
working systems without a combined activation rule left a real gap: a
driver could reach `APPROVED` having satisfied only the pre-existing
KYC-document check. `DriverActivationService.checkEligibility()` /
`assertEligible()` is now the single source of truth for all six activation
conditions (identity verified, required documents approved, vehicle
approved, latest inspection passed, agreement accepted, account not
locked); `DriversService.approveDriver()` and `reactivateDriver()` both call
it instead of duplicating any check inline, and the full result is exposed
read-only via `driver/activation-eligibility` and
`admin/driver/:id/activation-eligibility`. See DPX-DRIVER-002 Phase 4 for
the full detail, including the one known asymmetry (a later failed
inspection doesn't auto-revert an already-approved vehicle's status —
`inspectionPassed` reads `Inspection` directly rather than trusting
`Vehicle.approvalStatus` as a proxy, so the gate stays correct regardless).

One thing this pass deliberately did **not** do, named honestly rather than
silently skipped:

- **The Operations Portal's Inspection UI (queue, checklist form, photo
  capture, approve/reject, re-inspection scheduling, report printing,
  history) is backend-only for this pass.** Per the standing Figma-first
  rule, no screens were invented — the endpoints exist and are ready for a
  UI once designs are provided.

**Freeze approved (2026-08-04).** Per founder review against exactly the
production requirements above — identity/security, vehicle management, and
the inspection system, with the unified activation gate as the resolved
final blocker — Driver Slice 1 is now frozen: bug fixes for verified
defects, security patches, performance improvements, regulatory changes, and
explicitly-approved enhancements only. No functional expansion without
opening a new slice, the same rule Ride/Marketplace/Wallet are held to (see
`docs/DPX-100-MODULE-COMPLETION-GATE.md`). The one open design note from the
freeze review — whether a failed re-inspection should auto-revert an
already-approved vehicle's status — is recorded as a future milestone, not a
reopening: `docs/DPX-DRIVER-004-VEHICLE-APPROVAL-LIFECYCLE-POLICY.md`.

## Founder-reordered priority (2026-08-04)

Supersedes this document's original priority list. Per-item status, incorporating
what's already real:

1. **Driver onboarding & KYC** (incl. inspection) — ✅ Backend real, **Frozen**
   (Slice 1, 2026-08-04); Operations Portal Inspection UI and driver-portal
   onboarding UI still pending Figma designs.
2. **Vehicle management** — ✅ Backend real, **Frozen** (Slice 1, 2026-08-04);
   driver-portal UI still pending Figma designs.
3. **Availability (online/offline)** — ✅ Already real, no work needed.
4. **Shift management** — ❌ Missing. Not named in the founder's initial
   Slice 2 recommendation (2026-08-04); founder confirmed same day it should
   be **folded into Slice 2** rather than deferred or dropped — included in
   Slice 2's scope below.
5. **Navigation** — ⚠️ Already partial (real Google Directions routing); voice
   guidance/nav-app handoff remains open. Named explicitly in Slice 2 below.
6. **Earnings dashboard** — ✅ Already real, no work needed.
7. **Driver wallet & payouts** — ✅ Already real, no work needed.
8. **Ratings & reviews** — ✅ Already real, no work needed.
9. **Support** — ❌ Missing. Named explicitly in Slice 2 below (superseding
   this document's earlier "Slice 3 — Support" split).

## Proposed slice plan

1. **Slice 1 — Driver onboarding, KYC & vehicle management (DPX-DRIVER-002).**
   **🔒 Frozen, founder-approved (2026-08-04)** — including the unified
   activation gate; see the status note above for exactly what shipped. UI
   for both driver-portal and Operations Portal remains deferred, not
   silently skipped — Figma-first. NIN/BVN and criminal/watchlist checks
   stay explicitly out of scope until their provider decisions land
   (DPX-DRIVER-003 for the latter). The one open design note from the freeze
   review is `docs/DPX-DRIVER-004-VEHICLE-APPROVAL-LIFECYCLE-POLICY.md`, a
   future milestone, not a reopening.
2. **Slice 2 — founder-approved scope (2026-08-04):** Navigation
   (voice guidance/nav-app handoff), Trip execution, Shift management
   (folded in per founder confirmation the same day), Driver support,
   Incident reporting, Driver help centre, Emergency/SOS, Communication
   tools (call/chat), Driver profile enhancements, Operational
   notifications. Supersedes this document's earlier "Slice 2 — Shift
   management" / "Slice 3 — Support" split. Each item needs its own
   reality-check pass before a build plan is written, same discipline as
   Slice 1: several (Trip execution, Communication tools, Incident
   reporting) likely depend on real-time infrastructure (`RideGateway`-style
   WebSocket patterns) that exists for Ride but has never been built for
   Driver-side support/incident flows — a real scoping question, not assumed
   solved by precedent alone. **Reality audit complete:**
   `docs/DRIVER-SLICE-2-AUDIT.md` — one item (Trip execution) is already
   real, most of the rest are genuinely new systems with real open
   decisions the founder needs to resolve before a build plan is written
   (named in that document, not assumed here). **All nine founder-scoped
   items now shipped and production-audited (2026-08-04)** — see
   `docs/DRIVER-SLICE-2-AUDIT.md`'s per-item "✅ Shipped" blocks and
   `docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md` for the full audit. Awaiting
   founder review; not yet frozen.
3. **Slice 3 — DPX-100 port.** Once the above are real, re-platform the whole
   Driver App (existing screens plus the new pieces) into `packages/ui/super-app`,
   matching the same port discipline Ride/Marketplace/Wallet went through, then
   the same audit + freeze gate.

Slice 1 is frozen. Slice 2 (founder-approved scope, including shift
management) is now feature-complete and production-audited — see
`docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md` — awaiting founder review before
freeze. Slice 3 (DPX-100 port) has not started.
