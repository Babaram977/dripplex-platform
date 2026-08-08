# DPX-DRIVER-009 — Driver Readiness Map & Founder Decision Register

**Date:** 2026-08-08 · **Baseline:** `main` @ `447ac52` (PR #54 merged) · **Figma:** live, `rsHHFRxHVE3OKv81p7m3K1` (Make file, read-only)
**Nature:** audit only — **no code changes**. Verify-before-build; founder decisions listed separately for approval.

This is the consolidated Driver readiness map after the registration-completion (#54) and admin-review (#55, open) slices. It reconciles the actual merged code + live Production Figma. It exists so the remaining Driver decisions are made by the founder, not guessed.

---

## A. State verified

- `main` @ `447ac52`. **PR #55 (DPX-DRIVER-008 admin review/approval)** is **open, not merged** (no conflict); its logic was verified green (typecheck/lint, backend driver 32/32, sdk 163, ops-console build).
- Figma MCP live (SaeedDanwakili). Selfie, vehicle, and auth screens read live this cycle.

---

## B. Readiness map (verified)

| Area                                                         | State                            | Blocker                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Driver registration → SUBMITTED (#54)                        | ✅ Works                         | —                                                                                                                                                                                                                                                                                                                            |
| Admin driver review + KYC verify/reject + lifecycle (#55)    | ✅ Built (in review)             | merge pending                                                                                                                                                                                                                                                                                                                |
| **Admin vehicle approval**                                   | 🟢 **Ready to build**            | none — Figma ✓ (Ops Console "Vehicles"), SDK ✓ (`adminDriverVehicles.list/approve/reject`), backend ✓, perms ✓ (`admin:drivers:vehicles:manage`). **No UI calls it today**, so vehicles sit `PENDING` forever → **a driver can never pass the `vehicleApproved` activation check**. Needed to truly close the approval loop. |
| Auth — register with phone **or** email (Super-App/customer) | ✅ Works                         | synthetic-email mechanism                                                                                                                                                                                                                                                                                                    |
| Auth — **login for phone-only accounts**                     | 🔴 **Broken**                    | `login.service.ts:208-210` forces verified email; phone-only accounts can't log in (see Decision 1)                                                                                                                                                                                                                          |
| Identity / selfie / liveness capture (driver-facing)         | 🔴 Figma-gated                   | **no capture screen exists in Figma anywhere**; backend expects `selfieImageBase64`; `identityVerified` activation check can't be satisfied via UI                                                                                                                                                                           |
| OPay ride payment                                            | 🔴 Non-functional but selectable | real `OpayProvider` throws `NotImplementedException`; `OPAY` is in the enum + `GATEWAY_METHODS` + accepted by the pay DTO → **prod 501** (see Decision 3)                                                                                                                                                                    |
| File upload / storage                                        | 🔴 Absent                        | blocks 4 surfaces: KYC docs, driver profile photo, vehicle photos, identity selfie (see Decision 5)                                                                                                                                                                                                                          |
| Ride core (dispatch/fare/tracking/rating/settlement)         | ✅ Implemented                   | commission/fare are placeholders pending sign-off (Decision 4)                                                                                                                                                                                                                                                               |
| Permissions                                                  | ✅ Complete                      | every driver route gated, every driver permission role-mapped                                                                                                                                                                                                                                                                |

---

## C. Founder Decision Register

Each needs a founder call before implementation. Nothing here was decided or built.

### Decision 1 — Auth: enable "phone OR email" identity (foundational)

**Verified:** the backend was built for either identifier (portal `register`/`login` take optional email + optional phone with a "one-or-the-other" validator; lookup resolves by email-else-phone; both phone-OTP and email-OTP exist). Single Super-App identity is intact — there is **no** separate driver auth stack to remove; driver = an authenticated Super-App user + driver onboarding.
**Gaps:**

- **1a (bug, backend-only, no Figma):** phone-only accounts **cannot log in** — `assertAccountEligible` requires a non-null `emailVerifiedAt`, which a phone-only (synthetic-email) user never has. **Smallest fix:** exempt synthetic emails from that one gate (`if (!user.emailVerifiedAt && !isSyntheticEmail(user.email))`) — single file, single condition; DTOs/lookup/schema already support both.
- **1b (Figma):** the live Figma Auth flow is **phone-only** (Register/Sign-In/OTP), no email-identifier field or Phone/Email toggle. A visible "choose email" sign-in needs a Figma design first.
- **1c (cleanup):** legacy email-only paths remain wired — `RegisterDto` + `POST /auth/register`, and SDK bare `login()`/`register()` (the latter points at a non-existent `/auth/login`). Retire to stop an email-only path sneaking back.
- **Rider/driver-specific registration** (`/auth/register/driver`) requires phone by design — reconcile with the single-identity model or leave as-is.

> **Recommendation:** approve 1a now (backend-only, unblocks the stated goal); decide 1b (design email UI vs keep phone-primary + email-add-later); schedule 1c cleanup.

### Decision 2 — Admin vehicle approval (ready-to-build slice)

Figma + SDK + backend + perms all exist; no UI calls approve/reject, so the approval loop can't complete. The core (pending queue + Approve/Reject) is buildable **now** with no invention.

> **Not-backend-supported Figma extras to confirm scope on:** the Figma screen also shows a **vehicle photo grid** (blocked by storage, Decision 5), a **per-document checklist** (no vehicle-document model — only `Vehicle.photos: string[]`), and a **"Request Corrections"** action (**no backend endpoint** — approve/reject only). Recommend building core Approve/Reject now, documenting these three as follow-ups (no invented endpoints).

### Decision 3 — OPay strategy (payment)

Confirmed selectable + non-functional (prod 501). Options: (a) implement the real adapter (needs OPay merchant creds), (b) **safe-disable** — reject `OPAY` at selection so customers can't pick it (note: the ride-lifecycle e2e injects a _fake working_ OPAY adapter, so a disable also edits that test), or (c) leave with a documented warning. **Not decided — payment/founder call.**

### Decision 4 — Commission rate + fare table sign-off

`RIDE_PLATFORM_COMMISSION_RATE = 0.15` and `RIDE_FARE_RATES` are placeholders marked "founder approval required before production." Functional, but economically unapproved → blocks go-live.

### Decision 5 — File upload / storage architecture

No storage backend exists; 4 driver surfaces are URL/base64 stopgaps or absent (KYC docs, profile photo, vehicle photos, identity selfie). Choosing a storage approach (e.g. object storage + signed uploads) unblocks all four, including the Figma selfie-capture screen (which also needs designing, Decision 6).

### Decision 6 — Driver selfie / liveness capture

No Figma capture screen exists. The `identityVerified` activation check can't be satisfied from the UI. Needs (a) a Figma design and (b) storage (Decision 5). Until both, driver identity verification can't complete via self-service.

### Decision 7 — Passenger verification screen

The Figma "Verify Passenger" screen (4-digit trip OTP before ride start) **conflicts with the founder-locked "no passenger PIN before ride start"** backend decision. Drop the Figma screen, or reverse the lock. **Do not build either way without this call.**

### Decision 8 — Field-level Figma-vs-backend diffs

- **Passenger Seats** (Figma vehicle field) — no `seats` column; add or confirm `rideCategory` covers it.
- **"Road Worthiness"** document type — not in `KycDocumentType`; add or confirm out of scope.
- **"Passport Photo"** document type — no distinct photo type (only `PASSPORT`); add or fold into `PASSPORT`.

---

## D. SDK / controller coverage gaps (audit, low priority)

Seven admin driver-domain controllers still have no SDK client (admin ride-reports, sos-alerts, incident-reports, driver-support-tickets, driver-shifts, driver-planned-availability, driver identity-verification require/unlock). Driver-side + admin-vehicle/inspection coverage is complete. Building these SDK-only clients is low value until a consuming UI needs them — documented, not scheduled.

---

## E. Recommended sequencing (for founder approval)

1. **Merge PR #55** → tag `driver-admin-review-approval`.
2. **Decision 1a** (auth phone-only login fix) — small backend slice, unblocks the stated identity goal.
3. **Decision 2** (admin vehicle approval) — completes the approval loop end-to-end.
4. Then the payment/storage/design decisions (3–8) as the founder prioritizes.

**No code was changed in this cycle.** Awaiting founder decisions before implementation.
