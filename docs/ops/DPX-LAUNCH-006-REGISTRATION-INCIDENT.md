# DPX-LAUNCH-006 — Production Registration Incident (2026-08-07)

**Status:** Resolved and confirmed. Founder reproduced the full flow
(register → OTP email received → verified → logged into dashboard) on
production after the second fix below.

## What happened

Founder tested live registration at `https://www.dripplex.com/register`
immediately after DPX-LAUNCH-005 (Termii/Resend wiring) landed and hit
two sequential, unrelated bugs before the flow actually worked.

## Bug 1 — `Role customer is not configured` (404 on every portal)

**Cause:** production's `Role`/`Permission`/`RolePermission` tables were
never seeded. Railway's backend `preDeployCommand` only ran
`prisma migrate deploy` (schema), never seed data.
`PrismaRegistrationRepository.registerPortalUser()` does
`Role.findFirst({ where: { name: roleName } })` and throws when missing
— this blocked registration on **every** portal (customer/merchant/
rider/driver), not just customer.

**Fix, attempt 1 (commit `28826a1`):** added
`apps/backend/prisma/seed-rbac.cjs` — a plain CommonJS script (ts-node
is a devDependency stripped from the production image, so nothing in
`prisma/` can run via ts-node there) that upserts only RBAC data
(Permission/Role/RolePermission), deliberately excluding
`prisma/seed.ts`'s marketplace fixture data. Wired via
`preDeployCommand: ["node_modules/.bin/prisma migrate deploy && node prisma/seed-rbac.cjs"]`.

**This did not work.** Deployment reported SUCCESS but founder hit the
identical error again. Root cause: **Railway spawns `preDeployCommand`
directly, not through a shell** — `&&` is not a shell operator there,
it's passed to Prisma's CLI as a stray positional argument, which
Prisma silently ignores. The command exited 0 after just running
`migrate deploy`; the seed half never executed. Confirmed directly in
deploy logs: `"No pending migrations to apply."` is immediately
followed by `"Stopping Container"` — no seed output in between.

**Fix, attempt 2 (commit `34d3621`):** `seed-rbac.cjs` now runs
`prisma migrate deploy` itself via `child_process.execFileSync` before
seeding, so it's a single self-contained command with no dependency on
shell chaining. `preDeployCommand` simplified to
`["node prisma/seed-rbac.cjs"]`. Deploy logs then showed the expected
`"RBAC bootstrap: seeded 111 permissions, 9 roles, and role-permission
grants."` line — confirmed the seed actually ran this time.

## Bug 2 — registration succeeded, OTP email never arrived

With Bug 1 fixed, registration and the Verify-OTP screen both worked,
but the founder never received the OTP code by email.

**Cause:** `registration.service.ts` generated and stored the OTP
correctly (Redis), but called `OtpService.generateAndStore()` — a
variant with no dispatch callback. In production that path only logs
`"OTP generated"` and returns; it never calls a real provider. Of all
the OTP-issuing flows, only password reset (`PasswordService`) used
`generateStoreAndDispatch()` with a real `NotificationService`
callback. The Termii/Resend adapters landed in DPX-LAUNCH-005 were
correct and tested, but registration's email/phone OTP generation
never reached them — a wiring gap in `registration.service.ts`, not a
defect in the provider adapters themselves.

**Fix (commit `8eeb8e0`):**

- `registration.service.ts` now calls `otpService.generateStoreAndDispatch()`
  for both `email_verification` and `phone_verification`, passing a
  dispatch callback into the injected `NotificationService` — the same
  pattern `PasswordService` already used.
- Added `NotificationService.sendEmailOtp()` (new interface method).
  The existing `sendEmailVerification()` sends a token-based
  verification _link_, not a raw numeric code — the wrong shape for
  what the registration Verify-OTP screen actually submits
  (`VerificationService.verifyEmail` checks a raw OTP via
  `otpService.verify('email_verification', ...)`). Implemented in both
  `ProductionNotificationService` (real Resend send) and
  `LoggingNotificationService` (dev/CI stub).
- Added regression tests in `registration.service.spec.ts` asserting
  the dispatch callback actually calls `sendEmailOtp`/`sendPhoneOtp`
  with the right payload — the exact case Bug 2 would have failed.

## Verification

- Full backend suite green after each fix (175/175 suites, tsc/eslint
  clean) before every push.
- Railway deploy logs directly inspected after each deploy, not just
  deployment status — this is what caught Bug 1's silent no-op.
- Final confirmation: founder registered a real account
  (`danwakili@yopmail.com`), received the OTP email, verified it, and
  landed on the live dashboard.

## Known, separate, non-blocking gap (not touched by this incident)

The legacy passwordless-login OTP flow (`POST /auth/otp/request` +
`/auth/otp/verify`, `auth.service.ts`) has its own OTP generation path
that also never dispatches to a real provider — its own existing code
comment says as much. It's unrelated to registration and not used by
it; fixing it is a separate, explicit follow-up if that login flow is
ever exercised in production.

## Commits

| Commit    | What                                                        |
| --------- | ----------------------------------------------------------- |
| `28826a1` | RBAC seed script added (not yet wired)                      |
| `34d3621` | Wired into deploy pipeline; fixed (didn't work — Bug 1)     |
| `8eeb8e0` | Made seed self-contained (Bug 1 actually fixed) + Bug 2 fix |

All three are on `main`, deployed to Railway project `overflowing-unity`.
