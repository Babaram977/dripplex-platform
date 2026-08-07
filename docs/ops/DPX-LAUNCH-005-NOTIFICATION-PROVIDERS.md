# DPX-LAUNCH-005 — Production Notification Providers (Termii SMS + Resend Email)

> **Addendum (2026-08-07):** once the founder set the real Termii/Resend
> keys and tested live registration, two further bugs surfaced and were
> fixed — production's RBAC data was never seeded (blocked registration
> entirely, unrelated to this doc's work), and registration's OTP
> generation never actually called the providers below (a wiring gap in
> `registration.service.ts`, not a defect in `TermiiSmsSender`/
> `ResendEmailSender` themselves). See
> `docs/ops/DPX-LAUNCH-006-REGISTRATION-INCIDENT.md` for the full
> writeup. Confirmed working end-to-end after the fix.

Founder-authorized (2026-08-06) as the one backend task to close before
Launch Freeze, directly off the DPX-LAUNCH-004 production verification
finding: production was binding every OTP/password-reset/verification/
lifecycle notification to a log-only stub. This closes that gap with real
SMS (Termii) and email (Resend) delivery.

## The problem this fixes

`NotificationsModule` unconditionally bound `NOTIFICATION_SERVICE` to
`LoggingNotificationService` — a stub that logs "notification dispatched"
to Railway's server logs and never calls a real provider. That meant a
real customer's phone OTP, password-reset email, and email-verification
link were generated correctly and persisted correctly, but never actually
reached their phone or inbox. DPX-LAUNCH-004 flagged this as the single
highest-priority pre-launch blocker.

## What was implemented

**Backend** (`apps/backend/src/notifications`):

- `providers/termii-sms.sender.ts` — thin HTTP adapter over Termii's
  `POST /api/sms/send` (same `fetch`-based pattern as
  `payments/providers/paystack.provider.ts`, no new HTTP library).
- `providers/resend-email.sender.ts` — same pattern over Resend's
  `POST /emails`.
- `production-notification.service.ts` — the new `NOTIFICATION_SERVICE`
  binding. Implements every method the old `LoggingNotificationService`
  did (password reset, password changed, email verification, phone OTP,
  merchant/order/payment/delivery/driver/ride lifecycle, ride earnings),
  building the actual SMS text / email subject+HTML per call.
- **Each channel activates independently.** SMS goes through Termii only
  once `TERMII_API_KEY` is set; email goes through Resend only once
  `RESEND_API_KEY` is set. Whichever channel isn't configured yet falls
  back to `LoggingNotificationService`'s exact previous behavior for that
  channel — so partial rollout (e.g. SMS live today, email enabled next
  week) never regresses below where production was before this change,
  and an environment with neither key set behaves identically to before.
- **Best-effort delivery, not a new failure mode.** A real provider error
  (bad key, carrier rejection, network failure) is caught, logged at
  `warn`, and swallowed — never thrown into the calling flow. The
  OTP/token being delivered is already persisted (Redis or the
  identity-verification table) before the send is attempted, so a
  transient delivery failure doesn't lose it; the existing resend/cooldown
  flow is the recovery path, same as if a real SMS had bounced after
  leaving Termii.

**Config** (`src/config/env.validation.ts`, `app-config.service.ts`):
five new variables, all with safe defaults — `TERMII_API_KEY`,
`TERMII_SENDER_ID` (default `DrippleX`), `TERMII_BASE_URL` (default
`https://api.ng.termii.com`), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
(default `DrippleX <no-reply@dripplex.com>`).

## Environment variables to set (Railway → backend service)

| Variable            | Value                                   | Notes                                                                                      |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `TERMII_API_KEY`    | from your Termii dashboard              | treat as a secret                                                                          |
| `TERMII_SENDER_ID`  | your approved Termii Sender ID          | Termii requires this to be registered/approved for your account before SMS will send       |
| `TERMII_BASE_URL`   | `https://api.ng.termii.com`             | only override if Termii gives you a different regional endpoint                            |
| `RESEND_API_KEY`    | from your Resend dashboard              | treat as a secret                                                                          |
| `RESEND_FROM_EMAIL` | e.g. `DrippleX <no-reply@dripplex.com>` | the domain in this address must be a verified sending domain in Resend, or sends will fail |

Leaving any of these unset is safe — the backend boots normally either
way, and that channel keeps behaving exactly as it did before this change
(logged, not sent).

## How to verify once set

1. Set the five variables above on the Railway backend service and
   redeploy.
2. Trigger a real phone OTP (register or log in with a phone number) and
   confirm the SMS actually arrives.
3. Trigger a real password-reset request and confirm the email actually
   arrives, with the OTP code readable in it.
4. Spot-check the backend deploy/runtime logs for the absence of `SMS
delivery failed` / `Email delivery failed` warnings on those requests
   (a `warn` there means the provider rejected the send — check the
   logged `errorMessage`, most commonly an unapproved Sender ID on Termii
   or an unverified domain on Resend).

## Open items (not blocking, documented honestly)

- **Email verification's link has no landing page yet.** The verification
  email now includes a real link (`${CUSTOMER_APP_URL}/verify-email?token=...`),
  but `apps/customer-web` doesn't have a `/verify-email` route to consume
  it — clicking the link today would 404. The backend's
  `POST /auth/verify-email` endpoint that the page would call already
  exists (`verification.controller.ts`); only the frontend page is
  missing. This is genuine, scoped-out frontend work, not something this
  backend-only round covers.
- **`notification-center`'s separate `EMAIL_PROVIDER`/`SMS_PROVIDER`
  bindings are untouched**, still `NotConfiguredProvider` (same honest,
  non-blocking default as before). That system backs the in-app
  notification bell / admin broadcast feature, not the auth flows this
  round fixes — wiring it to the same Termii/Resend senders is a
  reasonable follow-up, but requires resolving a User's email/phone from
  a bare `Notification` record first, which this round didn't need to
  solve for the OTP/password-reset/verification path.
- **No live send was performed this session.** Termii/Resend credentials
  were not provided, so this is verified via unit tests (mocked `fetch`,
  15 new tests covering configured/unconfigured/success/failure paths for
  both senders and the composed service) and the full existing backend
  suite (175/175 suites, 1328/1328 tests green) confirming no regression
  — not a live SMS/email round-trip. That requires the founder's real
  Termii/Resend keys, same pattern as Google OAuth.
