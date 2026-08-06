# DPX-LAUNCH-003 — Google Sign-In (OAuth) Setup

Founder-authorized (2026-08-06) as a dedicated production feature, built on
the existing JWT/session architecture rather than as a quick patch. This
doc gives the founder everything needed to finish the Google Cloud Console
side of the setup: the exact redirect URI, the environment variables to
set, and how to verify it's live.

## What was implemented

**Backend** (`apps/backend`):

- `passport-google-oauth20` strategy (`src/auth/strategies/google.strategy.ts`),
  constructed safely at boot even with no credentials configured (matches
  the existing "safe no-op when unconfigured" pattern used for Google Maps
  and Smile ID).
- `GoogleConfiguredGuard` blocks the routes with a clear error until real
  credentials are set — it never silently no-ops a sign-in attempt.
- Routes, all under the existing `/auth` namespace:
  - `GET /auth/google` — starts the flow, redirects to Google's consent screen.
  - `GET /auth/google/callback` — Google redirects back here; the backend
    finds-or-creates the account and redirects the browser to
    `${CUSTOMER_APP_URL}/auth/google/callback?code=<handoff-code>`.
  - `POST /auth/google/exchange` — the frontend exchanges that short-lived,
    single-use handoff code for the real access/refresh token pair.
- Account linking, in order: match by `googleId` (returning user) → match
  by `email` (links Google to an existing password account, using Google's
  verified email as proof) → create a new customer account. No duplicate
  accounts.
- Session/token issuance reuses the existing `SessionService`/`TokenService`
  — a Google sign-in produces the exact same `AuthSession` + JWT pair as an
  email/password login.
- Full audit trail: `auth.google.login.started/success/failed`,
  `auth.google.account.linked/created` (see `src/audit/audit.constants.ts`).

**Frontend** (`apps/customer-web`):

- "Continue with Google" button on both the Login and Register screens
  (`src/components/forms/google-sign-in-button.tsx`), full-page redirect to
  `GET /auth/google`.
- `/auth/google/callback` page reads the handoff code, exchanges it, and
  completes sign-in the same way the password login form does.

**Why a handoff code and not a direct redirect with tokens:** the SDK's
HTTP client is Bearer-token based (`Authorization` header, tokens managed
client-side), not cookie-based — putting real JWTs in a browser-redirect
URL would leave them in browser history and referrer headers. The handoff
code is single-use (deleted from Redis on first read, whether or not the
exchange succeeds) and expires after 60 seconds.

## Exact redirect URI to register in Google Cloud

Confirmed from the implemented code (`GoogleAuthController`, mounted under
the app's `api/v1` global prefix):

```
https://api.dripplex.com/api/v1/auth/google/callback
```

For local/dev testing against a non-production backend, the equivalent is
`http://localhost:<port>/api/v1/auth/google/callback` — but only the
production URI above needs to go into the **live** OAuth Client's
Authorized Redirect URIs.

Authorized JavaScript origins (already set per the founder's note) should
remain `https://www.dripplex.com` (and any other customer-web-facing
domain that will offer Google Sign-In).

## Environment variables to set (Railway → backend service)

| Variable               | Value                                                  | Notes                                                                                                         |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | from the Google Cloud OAuth Client                     |                                                                                                               |
| `GOOGLE_CLIENT_SECRET` | from the Google Cloud OAuth Client                     | treat as a secret, same handling as other API keys                                                            |
| `GOOGLE_CALLBACK_URL`  | `https://api.dripplex.com/api/v1/auth/google/callback` | must exactly match what's registered in Google Cloud                                                          |
| `CUSTOMER_APP_URL`     | `https://www.dripplex.com`                             | where the backend redirects the browser after sign-in completes; defaults to `http://localhost:3001` if unset |

All four default to safe empty/localhost values when unset — the backend
boots normally either way. Until all three `GOOGLE_*` variables are set,
`GET /auth/google` and `GET /auth/google/callback` return a clear
"Google Sign-In is not configured on this server" error instead of
attempting a broken OAuth handshake. Nothing else on the platform is
affected by leaving these unset.

## How to verify once set

1. Set the four variables above on the Railway backend service and
   redeploy (or wait for the next deploy to pick them up).
2. Visit `https://www.dripplex.com/login`, click **Continue with Google**.
3. Confirm the browser reaches Google's consent screen, and after
   approving, lands back on `https://www.dripplex.com/auth/google/callback`
   briefly before redirecting into the dashboard, signed in.
4. Spot-check the audit trail (`auth_audit_logs` via the admin/ops surface,
   or a direct query) for an `auth.google.login.success` entry.

## Open items (not blocking, documented honestly)

- No portal beyond Customer Web has a Google Sign-In button yet
  (merchant-portal, driver-portal, operations-console still use
  email/phone only) — the founder's scope explicitly said "Customer Web
  first, then other portals if desired," so this is a deliberate,
  not-yet-decided scope boundary, not a gap.
- This session's sandbox has no live Postgres/Redis connection, so the new
  migration and the exchange-code Redis round-trip are verified via
  `prisma validate`/`prisma generate` and unit tests respectively, not a
  live end-to-end run — the same documented constraint that has applied to
  every schema change this session.
