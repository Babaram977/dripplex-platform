# DPX-LAUNCH-007 — Production Cash-Launch Smoke-Test Runbook

**Purpose:** a step-by-step, operator-runnable validation of the DrippleX V1
**customer cash-ride** journey against a **live production** environment, using the
actual backend routes and DTOs on `main`. Run this once secrets, DNS/TLS, the
RBAC seed, and OTP providers are configured (see DPX-LAUNCH-008 for the
deployment sequence).

> This is a **verification** document. It changes nothing. All routes were
> extracted from the controllers on `main`; DTO field names are cited to their
> source files — do not assume fields not listed there.

## Conventions

- **Base URL:** `https://api.dripplex.com` + global prefix `api/v1`
  (`main.ts` → `app.setGlobalPrefix('api/v1')`). Every path below is
  `https://api.dripplex.com/api/v1<path>`.
- **Auth:** send `Authorization: Bearer <accessToken>` where noted. Tokens come
  from login (step 4). Access tokens are short-lived; re-login if a call returns 401.
- **Success envelope:** `{ "success": true, "data": ... }`; errors:
  `{ "success": false, "error": { "code", "message" } }`.
- **OPERATOR-SIDE markers:** ⚙️ = needs real prod config (secrets/DNS/provider);
  📱 = needs a real phone/email/device; 🚗 = needs a real approved driver account.

---

## 1. Production health check

- **Method/route:** `GET /health` (public — `health.controller.ts`, `@Public()`).
- **Auth:** none.
- **Expected:** `200` with `{ status: 'ok', checks: { database, redis } }`. `degraded` also returns `200`; `503` only if **both** DB and Redis are down.
- **Verify:** `status === 'ok'`; both checks healthy.
- **Failure:** `503`/timeout → the API or its Postgres/Redis is down. **ABORT** — do not proceed; see DPX-LAUNCH-008 rollback.

## 2. Customer registration

- **Method/route:** `POST /auth/register/customer` (`registration.controller.ts:19`).
- **Auth:** none.
- **Body:** per `RegisterCustomerDto` (phone-primary; email optional; password; name). Cite `apps/backend/src/auth/dto/*register*` for exact fields — phone is the stable identity, email may be omitted (a synthetic placeholder email is stored).
- **Expected:** `201`, user created `PENDING_VERIFICATION`; response echoes `emailOtpSent` / `phoneOtpSent` booleans (never the code).
- **Verify (DB):** `users` row exists, `status = PENDING_VERIFICATION`.
- **Failure:** `409` duplicate phone/email → pick a fresh test identity. `422` → body shape; check the DTO.
- **Abort:** repeated `500` → registration/RBAC misconfigured (see step-0 note: RBAC must be seeded, DPX-LAUNCH-008).

## 3. OTP delivery + verification 📱⚙️

- **Send:** `POST /auth/phone/send-otp` (`phone-verification.controller.ts:17`); email equivalent `POST /auth/email/send-verification`.
- **Verify:** `POST /auth/phone/verify` body `{ phone, otp }` (`phone-verification.controller.ts:29`); email `POST /auth/email/verify`.
- **Auth:** none (identifies by phone/email).
- **Expected:** send → `200/201`; verify with the correct code → `200`, phone/email marked verified; the account activates when required verifications complete (`prisma-users.repository.ts activateIfVerificationsComplete`).
- **Verify:** ⚙️ the OTP SMS/email is **actually received** on a real device — this proves `TERMII_API_KEY` / `RESEND_API_KEY` are set. In non-prod the code is only logged; in prod it must be delivered.
- **Failure:** OTP never arrives → **provider not configured** (Termii/Resend) → **ABORT** the launch gate; set the keys. `401 OTP_INVALID/OTP_EXPIRED` → wrong/expired code.

## 4. Login

- **Method/route:** `POST /auth/login/customer` (`login.controller.ts:17`).
- **Body:** `PortalLoginDto` — `{ email? | phone?, password }` (`auth/dto/portal-login.dto.ts`).
- **Expected:** `200` with an access token + refresh token; the account must be `ACTIVE` (login rejects `PENDING_VERIFICATION`/`BLOCKED`/`SUSPENDED`).
- **Verify:** capture `accessToken` for subsequent calls.
- **Failure:** `401 EMAIL_NOT_VERIFIED` → finish step 3; `401` invalid creds → recheck.

## 5. Wallet / account verification

- **Account:** `GET /auth/me` (`auth.controller.ts:94`, Bearer).
- **Wallet:** `GET /customer/wallet` (`customer-wallet.controller.ts`, Bearer, `customer:wallet:read`).
- **Expected:** `200`; `/auth/me` returns the identity (name/phone/email, roles, permissions); wallet returns a balance (0 for a new customer).
- **Verify:** roles include `customer`; wallet reads without error (proves RBAC seeded + wallet wired).
- **Note:** wallet **top-up** is gateway-based (dormant at cash launch); not required for a cash ride.

## 6. Ride request

- **Method/route:** `POST /customer/rides` (`customer-rides.controller.ts:75`, Bearer, `customer:ride:manage`).
- **Body:** `RequestRideDto` — `{ rideType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, ... }` (`rides/dto/request-ride.dto.ts`). Optional: `POST /customer/rides/estimate` first for a fare quote.
- **Expected:** `201`, ride created `REQUESTED` → `SEARCHING`; dispatch begins.
- **Verify (DB):** `rides` row, `status` in (`REQUESTED`,`SEARCHING`), `totalFare` set.
- **Failure:** `422` bad coords; `400` if the customer is ineligible.

## 7. Driver matching 🚗

- **Behavior:** the dispatch sweep offers the ride to the nearest eligible online driver (`ride-dispatch.service.ts`); `NO_DRIVERS_FOUND` if none.
- **Driver side:** the driver must be **online** — `POST /driver/rides/availability` (`driver-rides.controller.ts:49`), then `GET /driver/rides/offers` (`:89`).
- **Verify:** ride transitions to `DRIVER_ASSIGNED` after the driver accepts (step 8).
- **Failure:** `NO_DRIVERS_FOUND` → ensure a real approved driver is online in the test area. **This requires a real approved driver account** (see Driver launch gate — not part of a customer-only smoke test).

## 8. Ride acceptance / start / completion 🚗

- **Accept:** `POST /driver/rides/offers/:id/accept` (`:106`).
- **Arrive:** `POST /driver/rides/:id/arrive` (`:132`).
- **Start:** `POST /driver/rides/:id/start` (`:147`) — gated on driver GPS proximity ≤ 50 m (founder-locked).
- **Complete:** `POST /driver/rides/:id/complete` (`:158`).
- **Expected:** status flows `DRIVER_ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`.
- **Verify (DB):** `rides.status = COMPLETED`, `completedAt` set.
- **Failure:** `409` on an out-of-order transition (guarded state machine) — follow the sequence.

## 9. Cash confirmation

- **Method/route:** `POST /driver/rides/:id/cash-confirm` (`driver-rides.controller.ts:190`, driver Bearer).
- **Expected:** `200`; ride `paymentStatus → PAID`, `paymentMethod = CASH`. The customer's cash is collected physically; no digital balance moves.
- **Verify (DB):** `rides.paymentStatus = PAID`, `platformCommission` and `platformCommissionRate` written.

## 10. Verify the 10% commission

- **Verify (DB):** on the settled ride, `platformCommissionRate = 0.10` and `platformCommission = round(totalFare * 0.10)`, `driverEarning = totalFare − platformCommission`.
- **Source:** `DEFAULT_PLATFORM_COMMISSION_RATE = 0.10` (Ops-configurable via `PATCH /admin/commercial/commission-settings`). If Ops changed the rate before this ride settled, expect that rate instead (it is snapshotted per-ride).
- **Failure:** rate ≠ expected → confirm the active `platform_commission_settings` row.

## 11. Settlement (commission accrual)

- **Behavior:** cash confirmation accrues the platform commission to the **driver's** `CommissionAccount` (cash never enters the digital ledger).
- **Verify (DB):** a `commission_ledger_entries` row for the driver account, `referenceType = 'ride'`, `referenceId = <rideId>`, amount = the commission; `commission_accounts.outstandingBalance` increased by it.
- **Failure:** no ledger entry → settlement path misfired; capture logs.

## 12. Receipt / history

- **Receipt:** `GET /customer/rides/:id/receipt` (`customer-rides.controller.ts:179`, Bearer).
- **History:** `GET /customer/rides` (`:90`).
- **Expected:** `200`; receipt shows fare + method CASH; history lists the completed ride.

## 13. Admin refund

- **Method/route:** `POST /admin/rides/:id/refund` (`admin-ride-payments.controller.ts:36`, **admin** Bearer, `admin:rides:support`). Full refund only; no customer self-service refund.
- **Expected:** `200`; ride `paymentStatus → REFUNDED`.
- **Verify (DB):** `rides.paymentStatus = REFUNDED`.

## 14. Verify refund / commission reversal

- **Cash ride:** the refund reverses **only** the driver's accrued commission (no digital customer refund is manufactured for cash — founder-locked).
- **Verify (DB):** a `commission_ledger_entries` reversal row (`referenceType = 'ride_commission_reversal'`, `referenceId = <rideId>`); the driver's `outstandingBalance` returns toward its pre-ride value.
- **Failure:** duplicate refund → `409 "already been refunded"` (expected; idempotent).

---

## GO / ABORT summary

- **GO** for customer cash launch when steps 1–14 pass on production with real OTP delivery and a real approved driver, and the 15% commission + reversal verify in the DB.
- **ABORT** conditions: health `503`; OTP not delivered (provider unset); registration `500` (RBAC not seeded); commission rate/settlement/reversal mismatch. Rollback per DPX-LAUNCH-008.

## What this runbook cannot self-verify (OPERATOR/DEPLOYMENT-SIDE)

Real DNS/TLS, live secret values, actual SMS/email delivery, a real approved **driver** account (Driver launch is a separate gate), and the deployed image == intended `main` commit. Confirm these out of band (DPX-LAUNCH-008).
