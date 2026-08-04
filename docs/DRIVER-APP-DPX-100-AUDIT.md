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

## The current blocking decisions: DPX-DRIVER-002's open items

Per `docs/DPX-DRIVER-002-INSPECTION-STANDARD.md` (founder-approved design, not yet
implemented), driver onboarding is being upgraded from digital-KYC-only to a
four-phase flow that includes mandatory physical vehicle/driver inspection. That
document names its own open, founder-decision-blocked items — repeated here so
this audit's slice plan stays honest about what can start immediately versus what's
still waiting on a call:

- **Criminal/watchlist-check provider** — no background-check vendor is integrated
  or chosen. The single largest open item; needs its own decision before related
  code ships, same weight as the facial-verification provider choice was.
- **Inspector portal/app** — whether inspectors get their own app (mirroring
  `driver-portal`) or work inside `operations-console` is undecided.
- **NIN/BVN provider** — Smile ID's Nigeria-specific NIN/BVN products are the likely
  candidate given it's already integrated for facial verification, but that's a
  recommendation, not a decision made here.

None of these block the rest of the module — see the slice plan below.

## Founder-reordered priority (2026-08-04)

Supersedes this document's original priority list. Per-item status, incorporating
what's already real:

1. **Driver onboarding & KYC** (incl. inspection) — ⚠️ Partial, this is the current
   focus. See Slice 1 below.
2. **Vehicle management** — ❌ Missing, absorbed into Slice 1 (DPX-DRIVER-002 Phase
   1/3 needs the `Vehicle` model as a prerequisite — not a separate later effort).
3. **Availability (online/offline)** — ✅ Already real, no work needed.
4. **Shift management** — ❌ Missing, Slice 2 below.
5. **Navigation** — ⚠️ Already partial (real Google Directions routing); voice
   guidance/nav-app handoff remains open, not reprioritized ahead of the above.
6. **Earnings dashboard** — ✅ Already real, no work needed.
7. **Driver wallet & payouts** — ✅ Already real, no work needed.
8. **Ratings & reviews** — ✅ Already real, no work needed.
9. **Support** — ❌ Missing, Slice 3 below.

## Proposed slice plan

1. **Slice 1 — Driver onboarding, KYC & vehicle management (DPX-DRIVER-002).** The
   `Vehicle` model (plate, make, model, color, year, one-or-more-per-driver,
   `isActive`), the structured multi-step onboarding flow (replacing the current
   single flat document-upload form), the new document/field additions (insurance,
   emergency contact — see DPX-DRIVER-002 Phase 1's table), and — pending the
   inspector-portal decision above — the `InspectionCentre`/`Inspection` models,
   appointment booking, and structured checklist from DPX-DRIVER-002 Phase 3.
   NIN/BVN and criminal/watchlist checks stay explicitly out of scope for this
   slice until their provider decisions land; the rest of the slice does not
   depend on them and can proceed now.
2. **Slice 2 — Shift management.** New model (planned availability windows,
   optionally shift-based incentive targets if the founder wants them tied to
   Driver Growth Campaign's existing tier system) + driver-portal UI.
3. **Slice 3 — Support.** A real ticket/help-request model + submission flow,
   scoped deliberately (a basic "submit an issue, admin sees a queue" loop is a
   defensible v1, not a full helpdesk platform) unless the founder wants more.
4. **Slice 4 — DPX-100 port.** Once the above are real, re-platform the whole
   Driver App (existing screens plus the new pieces) into `packages/ui/super-app`,
   matching the same port discipline Ride/Marketplace/Wallet went through, then
   the same audit + freeze gate.

Slices 2 and 3 don't depend on DPX-DRIVER-002's open provider decisions and could
proceed in parallel, but per the founder's reordering, Slice 1 (onboarding/KYC) is
the current priority.
