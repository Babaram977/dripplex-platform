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

| Priority item                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Availability (online/offline) | ✅ Real — `DriverAvailability` model (online, acceptingRides, location, vehicleType), `driver-portal`'s `online-toggle-card.tsx`, dispatch-integrated since RIDE-002.4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Earnings dashboard            | ✅ Real — ride settlement/commission split (RIDE-002.7), driver wallet access, `earnings/page.tsx`, Launch Mode Slice 4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Ratings                       | ✅ Real — passenger↔driver ratings (RIDE-002.8), `ride-ratings-display.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Wallet                        | ✅ Real — driver wallet permission + endpoints (RIDE-002.7), `wallet/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Navigation                    | ⚠️ Partial — `live-map.tsx` uses real Google Directions for pickup/dropoff routing when `GOOGLE_MAPS_API_KEY` is configured (MAPS-UI Slice 3); no turn-by-turn voice guidance or external nav-app handoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Driver onboarding             | ⚠️ Partial — `DriverProfile`/`DriverOnboarding`/`DriverKyc` models real; admin approve/reject/suspend workflow real (`admin-drivers.controller.ts`); driver-facing side is one generic document-upload endpoint (`POST /driver/kyc`), not a structured multi-step flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Vehicle management            | ❌ Missing — no `Vehicle` model. `VEHICLE_REGISTRATION` exists only as a `KycDocumentType` (an uploaded document, not structured data), and `DriverAvailability.vehicleType` is a single enum field (ride category), not a registered vehicle (plate, make, model, color, year) a driver can view/edit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Facial verification           | ✅ Backend real, UI deferred (DPX-DS-001) — provider-agnostic risk engine (10 triggers: onboarding, first-login-of-day, idle timeout, new device, GPS anomaly, suspicious activity, random spot-check, credential change, failed-login lockout, manual admin), `SmileIdProvider` (real request signing, environment-blocked on live credentials only), 5-failure lockout with admin unlock, full audit trail (`DriverIdentityVerification`). Per DrippleX's Figma-first process, no capture/verification-required screen was built — driver-portal only sends the signals the risk engine needs; the actual UI ships when the Driver module's Figma designs are ported. See `docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md` and `docs/DPX-900-DRIVER-SECURITY-TRUST.md`. Not to be confused with the Figma auth flow's "biometric" screen (device Face ID/Touch ID app-unlock via WebAuthn — a different, already-documented gap in Wallet Security) |
| Shift management              | ❌ Missing entirely — no scheduling/shift-target model or endpoint anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Support                       | ❌ Missing entirely — no ticket/help-request model or endpoint anywhere in the platform, for any portal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## The one blocking decision: facial verification provider

This is flagged separately because, per the founder's direction, it's a **production
standard for this module, not an optional enhancement** — so it can't be scoped as "build
the UI, leave the backend as a documented gap" the way, say, Wallet's Face ID/WebAuthn
gap was. A real driver-onboarding facial/liveness check needs a real third-party identity
provider (this is a specialized capability — face-match-to-ID-document plus
liveness-anti-spoofing — not something to build from scratch). This is the same class of
decision as picking Paystack/Flutterwave/OPay for payments: it has real cost and
data-residency/compliance implications, so it needs the founder's call before any backend
work starts, not an autonomous choice.

Three real options, for context (not a recommendation to silently act on):

- **Smile ID** — the dominant identity-verification vendor across Africa/Nigeria
  specifically, with NIN/BVN/driver's-license database checks plus liveness, which most
  Nigerian ride-hailing/delivery platforms already use for driver KYC.
- **AWS Rekognition Face Liveness** — cloud-native, integrates cleanly if AWS is (or
  becomes) part of the infra stack, no Nigeria-specific document-database checks though.
- **Onfido / Persona / Veriff** — global identity-verification vendors, strong liveness,
  less Nigeria-specific document coverage than Smile ID.

Whichever is chosen, the build pattern already exists in this codebase to follow: a real
`DriverFacialVerificationProvider` interface + adapter (mirroring
`PaymentProviderAdapter`/`PayoutProvider`), wired into the onboarding flow for real once
credentials exist, throwing `NotImplementedException` until they do — never a fake
"verified" state.

## Proposed slice plan (pending the decision above)

1. **Slice 1 — Vehicle management + structured onboarding.** New `Vehicle` model
   (plate, make, model, color, year, one-or-more-per-driver, `isActive`), real CRUD
   endpoints, and a real multi-step onboarding flow on top of the existing
   `DriverProfile`/`DriverKyc` models (currently a single flat document-upload form).
   No provider decision needed — can start immediately.
2. **Slice 2 — Facial verification.** ✅ Done (DPX-DS-001) — see
   `docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md` and
   `docs/DPX-900-DRIVER-SECURITY-TRUST.md`.
3. **Slice 3 — Shift management.** New model (planned availability windows, optionally
   shift-based incentive targets if the founder wants them tied to Driver Growth
   Campaign's existing tier system) + driver-portal UI.
4. **Slice 4 — Support.** A real ticket/help-request model + submission flow, scoped
   deliberately (a basic "submit an issue, admin sees a queue" loop is a defensible v1,
   not a full helpdesk platform) unless the founder wants more.
5. **Slice 5 — DPX-100 port.** Once the above are real, re-platform the whole Driver App
   (existing screens plus the four new pieces) into `packages/ui/super-app`, matching
   the same port discipline Ride/Marketplace/Wallet went through, then the same audit +
   freeze gate.

Slices 1, 3, and 4 don't depend on the facial-verification decision and can proceed in
parallel with that conversation. Slice 2 is the one genuinely blocked item.
