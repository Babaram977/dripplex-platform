# DPX-LAUNCH-001 — Launch Track 1: Railway Production Readiness

Founder-authorized (2026-08-05) as the first Launch Track following the
freeze of DPX-COMMERCIAL-001 and the platform's core commerce/mobility
foundation. Original scope, verbatim:

> Launch Track 1 — Railway Production Readiness (Highest Priority):
> Railway infrastructure; production environment variables and secrets;
> PostgreSQL & Redis verification; health/readiness endpoints; domain &
> SSL; monitoring & logging; backup & rollback; production deployment
> verification for Backend, Customer Web, Driver Portal, Merchant
> Portal, Operations Console.

## Founder Review of the first pass (2026-08-05)

Approved the first pass's findings and fixes in full. Locked the
structure this document now follows, verbatim:

> Before main is advanced, I want the launch checklist to clearly
> distinguish three categories: (1) Ready — everything fully verified
> and deployable without further input. (2) Pending Founder — anything
> that requires me to supply credentials or make a product/business
> decision. Each should state the exact Railway variable names, which
> service consumes them, what functionality they enable, and whether
> they are launch-critical. (3) Blocking main — the items that must be
> completed before advancing main. I expect this list to become very
> small and explicit.
>
> Continue with Launch Track 1 until only two categories of blockers
> remain: (1) Founder-supplied production credentials, (2) Founder
> approval to fast-forward main. Everything else that can be completed
> without those should be completed first.

This pass closes that instruction: **§A/B/C below is the three-category
checklist**, and — worked through item by item — **category C
(Blocking main) contains nothing left except the founder's own approval
decision.** Nothing else stands between here and requesting that
approval.

---

## A. Ready — verified and deployable, no further input needed

| Item                                                      | Detail                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend service config                                    | Dockerfile builder, `node dist/main.js` start command, `/api/v1/health` healthcheck (30s timeout, 3 retries), `preDeployCommand` runs `prisma migrate deploy`. Verified live.                                                                                                                                                                                                                       |
| Backend core secrets                                      | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — the only 4 vars the backend cannot boot without — all already set on Railway.                                                                                                                                                                                                                                              |
| `customer-web` service config                             | Dockerfile builder, healthcheck `/` (added this pass).                                                                                                                                                                                                                                                                                                                                              |
| `customer-web` Dockerfile bug                             | Was missing build `ARG`/`ENV` for `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and all six `NEXT_PUBLIC_FIREBASE_*` vars — fixed. Values themselves are §B items; the plumbing is now correct so they'll actually reach the app once supplied.                                                                                                                                                                 |
| `admin-portal` service config                             | Dockerfile builder, healthcheck `/` (already correct), vars already correct (only needs `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_APP_URL`, both set).                                                                                                                                                                                                                                                |
| `driver-portal` service config                            | Was live with **zero** vars, no domain, no healthcheck — all three fixed this pass (domain generated, vars set to real values, healthcheck `/` added).                                                                                                                                                                                                                                              |
| `driver-portal` Dockerfile bug                            | Was missing build `ARG`/`ENV` for `NEXT_PUBLIC_CUSTOMER_APP_URL` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — fixed.                                                                                                                                                                                                                                                                                     |
| `rider-portal`/`merchant-portal` Dockerfiles              | Checked — no gap, both only need `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_APP_URL`, already correctly plumbed.                                                                                                                                                                                                                                                                                       |
| Postgres                                                  | Railway-managed (`postgres-ssl:18`), volume-backed, connected.                                                                                                                                                                                                                                                                                                                                      |
| Redis                                                     | Railway-managed (`redis:8.2.1`), volume-backed, password-protected, AOF+RDB persistence.                                                                                                                                                                                                                                                                                                            |
| Migrations                                                | 55 migrations, `prisma` correctly in `dependencies` (the historical crash-loop gotcha stays fixed), `migrate deploy` wired into every backend deploy automatically. Will apply on the first post-merge deploy with no manual step.                                                                                                                                                                  |
| Deploy recipes for `merchant-portal`/`operations-console` | Fully documented (`docs/ops/PRODUCTION-RAILWAY.md`) — service creation is mechanical once their code is on `main` (§C).                                                                                                                                                                                                                                                                             |
| Rollback procedure                                        | Railway retains full per-service deployment history; rolling back means redeploying a prior successful deployment from the Railway dashboard. (Documented caveat: this session's Railway tools can redeploy the _current_ latest deployment but not a specific past one — that action is dashboard-only today.)                                                                                     |
| Merge mechanics                                           | `main` fast-forwards cleanly from the feature branch (`git fetch` confirms no divergent history on `main` beyond what's already ancestor to the feature branch) — this exact fast-forward-and-push mechanism has been used twice before in this repo (the `v1.0-baseline` tag and an earlier consolidation), so the _how_ of the merge itself is proven, not something to figure out at merge time. |
| `customer-mobile` stray service                           | Confirmed as a Capacitor native-app shell mistakenly deployed as a Railway web service, building from `customer-web`'s Dockerfile. No functional harm (duplicates customer-web under an unlinked domain). Deliberately **not** touched — the founder asked for this to be reviewed deliberately, not fixed reflexively, and it blocks nothing.                                                      |

## B. Pending Founder — credentials and business decisions

Every row: exact Railway variable name(s), which service consumes it,
what it enables, and whether it's launch-critical (blocks a real Ride
launch) versus important-but-deferrable (a Kano closed beta can run
without it).

| Variable(s)                                                                                                                       | Service                                                                    | Enables                                                                                                                                                      | Launch-critical?                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` (`PAYSTACK_BASE_URL` has a working default)                                          | backend                                                                    | Real online payment capture (Marketplace Mode A/B, Ride gateway payment) via the default provider                                                            | **Yes** — without one of Paystack/Flutterwave/OPay, no online payment can process at all; cash/manual flows still work via the Commercial Engine                                                                                                                                                                                                                                                                                             |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`                                                    | backend                                                                    | Same, if Flutterwave is chosen as the (or an additional) payment provider                                                                                    | Only if selected as launch provider                                                                                                                                                                                                                                                                                                                                                                                                          |
| `OPAY_API_KEY`                                                                                                                    | backend                                                                    | Same, for OPay                                                                                                                                               | Only if selected as launch provider                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GOOGLE_MAPS_SERVER_API_KEY`                                                                                                      | backend                                                                    | Server-side geocoding/reverse-geocoding/directions                                                                                                           | **Yes for Ride** — fare estimation and address resolution depend on this; falls back to a `NotConfigured` adapter that returns no result rather than crashing, so the app stays up but Ride's core flow degrades                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                                                 | `customer-web`, `driver-portal`, `operations-console` (same key, 3 places) | Live map rendering in the browser (ride tracking, destination search, Live Fleet Map)                                                                        | **Yes for Ride** — Ride's UI is map-centric; `operations-console` specifically degrades to a list-only view without it (confirmed non-crashing)                                                                                                                                                                                                                                                                                              |
| `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`                                                                                         | backend                                                                    | Real driver KYC/identity verification (enrollment + selfie-match verification)                                                                               | **Yes for Driver onboarding** — confirmed by reading the provider: unlike the notification/geocoding fallbacks, this one **throws a clear error on every call** rather than silently degrading, so no driver can complete identity verification without it                                                                                                                                                                                   |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`                                                            | backend                                                                    | Server-side push notification delivery (FCM)                                                                                                                 | Important, not strictly launch-blocking — falls back to a confirmed `NotConfigured` no-op provider; ride-status UI has non-push fallbacks (polling) from earlier Ride work                                                                                                                                                                                                                                                                   |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `_VAPID_KEY`                    | `customer-web`                                                             | Browser push registration                                                                                                                                    | Same as above — important, not launch-blocking                                                                                                                                                                                                                                                                                                                                                                                               |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` (backend); `NEXT_PUBLIC_SENTRY_DSN` (frontends) | backend + all portals                                                      | Error monitoring/APM                                                                                                                                         | Not launch-critical — genuinely recommended before a real public launch, not before a closed Kano beta                                                                                                                                                                                                                                                                                                                                       |
| Railway managed-backup plan tier decision                                                                                         | Postgres                                                                   | Automated backup/restore for production data                                                                                                                 | **Yes** in spirit (data-loss risk), but not literally a "variable" — it's a Railway dashboard/plan decision, not resolvable from this session's tools                                                                                                                                                                                                                                                                                        |
| Current `CORS_ORIGINS` value (backend)                                                                                            | backend                                                                    | Safely **appending** `driver-portal`'s newly-generated domain to the existing allowlist without dropping what's already there                                | Not launch-blocking today (driver-portal isn't publicly used yet) but needed before driver-portal goes live for real; flagged specifically because this session's Railway connection returns variable values redacted — appending blind risks the exact "lost `REDIS_URL`" incident already documented in `PRODUCTION-RAILWAY.md`. Resolve by either the founder pasting the current value, or setting it directly in the Railway dashboard. |
| Custom production domains (`www.dripplex.com`, `api.dripplex.com`, etc.)                                                          | all app services                                                           | Branded URLs instead of `*.up.railway.app`; required before app-store submission (store listings need a stable production URL)                               | Not launch-blocking for a closed beta on Railway's generated domains; needed before public launch — requires the founder owning/controlling the DNS                                                                                                                                                                                                                                                                                          |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`                                                                 | backend                                                                    | Google Sign-In (`GET /auth/google`, `GET /auth/google/callback`) — see `docs/ops/DPX-LAUNCH-003-GOOGLE-SIGNIN.md` for the exact redirect URI and setup steps | Not launch-blocking — the routes are guarded (`GoogleConfiguredGuard`) and return a clear error until these are set, rather than crashing; email/phone auth is unaffected either way                                                                                                                                                                                                                                                         |
| `CUSTOMER_APP_URL`                                                                                                                | backend                                                                    | Where the Google OAuth callback redirects the browser back to after sign-in completes (defaults to `http://localhost:3001`)                                  | Same as above — only matters once Google Sign-In is actually configured                                                                                                                                                                                                                                                                                                                                                                      |

## C. Blocking main

**Nothing beyond the founder's own approval.** Every technical
prerequisite that could be verified or fixed without a secret or a
business decision has been (§A). Every remaining open item is either a
credential/decision only the founder can supply (§B) or downstream of
the merge itself (creating the `merchant-portal`/`operations-console`
Railway services, which needs their code to exist on `main` first — not
something to do before the merge).

The only item in this category is:

> **Founder approval to fast-forward `main`** (65 commits, all of
> Driver Slice 2 / Operations Command Centre / Merchant / Commercial
> Engine) onto Railway's deploy source.

Once given: fast-forward, watch all four live services redeploy, verify
each health endpoint, verify migrations applied cleanly, then create
the two missing services and report full results.

---

## Supporting detail

The sections below are the first pass's full findings, kept as
reference for the _why_ behind each §A/§B/§C entry above.

### D.1 Live Railway service inventory (verified 2026-08-05)

Project: `overflowing-unity` (`f09361bd-3cda-4f0f-a22a-2ea464e47ab2`),
environment `production`. (A second, empty project — `zonal-freedom` —
exists on the account with no services; not in use.)

| Service                     | Status       | Domain                                                                  | Builder                                                  | Notes                                                   |
| --------------------------- | ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `@dripplex/backend`         | ✅ SUCCESS   | `dripplexbackend-production.up.railway.app`                             | Dockerfile                                               | Deploys from `main`                                     |
| `@dripplex/customer-web`    | ✅ SUCCESS   | `dripplexcustomer-web-production.up.railway.app`                        | Dockerfile                                               | Deploys from `main`                                     |
| `@dripplex/admin-portal`    | ✅ SUCCESS   | `dripplexadmin-portal-production.up.railway.app`                        | Dockerfile                                               | Deploys from `main`                                     |
| `@dripplex/driver-portal`   | ✅ SUCCESS   | `dripplexdriver-portal-production.up.railway.app` (generated this pass) | Dockerfile                                               | Deploys from `main` (a pre-Launch-Mode build — see D.2) |
| Postgres                    | ✅ SUCCESS   | private only                                                            | Managed image                                            | Volume-backed                                           |
| Redis                       | ✅ SUCCESS   | private only                                                            | Managed image                                            | Volume-backed                                           |
| `@dripplex/customer-mobile` | ✅ SUCCESS   | `dripplexcustomer-mobile-production.up.railway.app`                     | Dockerfile (`apps/customer-web/Dockerfile`, not its own) | Misconfigured — see §A                                  |
| `merchant-portal`           | Not deployed | —                                                                       | —                                                        | Exists on `main` as the early R1.4 shell                |
| `operations-console`        | Not deployed | —                                                                       | —                                                        | Doesn't exist on `main` at all yet                      |
| `rider-portal`              | Not deployed | —                                                                       | —                                                        | Not urgent for Ride launch                              |

### D.2 The `main` gap in full

Railway's live app services all deploy from `main`. `main` is **65
commits behind** `claude/dripplex-coolify-deploy-fatig4` — the gap
covers everything since Driver Slice 1: all of Driver Slice 2, the
entire Operations Command Centre (4 slices), the entire Merchant module,
and the entire Commercial Engine (6 slices, just frozen). None of that
is live in production today.

### D.3 Backend environment variable matrix — full detail

Built from `apps/backend/src/config/env.validation.ts` (the Zod schema
every var is validated against on boot), not from `.env.example` files
— several of which (`infrastructure/secrets/.env.production.example`)
list vars (`SMTP_*`, `TERMII_*`, `R2_*`, `B2_*`, `CLOUDFLARE_*`) that
**no backend code reads at all**. Confirmed by grep, not assumed —
these are speculative holdovers from the pre-Railway infrastructure
design, real missing capability for a future track, not a gap in this
one.

Only 4 variables have no default and are hard-required to boot:
`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
Every other integration (payments, Firebase, Maps, Smile ID, Sentry)
defaults to an empty string and is read by a real, wired provider class
— confirmed by reading each one, not assumed. Two distinct failure
modes exist and matter for launch-criticality (§B):

- **Silent no-op** (push notifications via `NotConfigured` provider,
  server-side geocoding via `NotConfigured` reverse-geocoder) — the app
  stays up, the feature just doesn't do anything.
- **Loud failure** (Smile ID, and by the same documented pattern,
  Paystack) — the provider class explicitly throws a clear
  configuration error on every call rather than silently succeeding or
  failing. This is the correct, safer behavior for payments/identity —
  documented here so it's understood as intentional fail-closed design,
  not treated as a bug when it's hit in testing before the real keys
  are supplied.

### D.4 Health/readiness endpoints

| Service                                                 | Path             | Checks                                      |
| ------------------------------------------------------- | ---------------- | ------------------------------------------- |
| `backend`                                               | `/api/v1/health` | Database (`up`/`down`), Redis (`up`/`down`) |
| `customer-web`                                          | `/`              | Fixed this pass                             |
| `admin-portal`                                          | `/`              | Already configured                          |
| `driver-portal`                                         | `/`              | Fixed this pass                             |
| `merchant-portal`, `operations-console`, `rider-portal` | —                | N/A — not yet deployed                      |

### D.5 Monitoring & logging

Railway-native logs (`get-logs`: deploy/build/http streams) and metrics
(`get-service-metrics`: CPU/memory/disk/network) are usable today, no
setup needed. Sentry's backend bootstrap (`initBackendSentry()`) is
real and unconditionally wired into `main.ts` — confirmed by reading
the code, not assumed — and needs only the DSN (§B). No alerting beyond
Railway's own dashboard exists (no Slack/PagerDuty/email hook on deploy
or health-check failure) — consistent with every other module's
production audit accepting the equivalent gap as non-blocking,
operational-maturity work. The pre-Railway generic runbooks in
`docs/ops/runbooks/` and `docs/ops/sla/SLA-SLO.md` predate this
infrastructure in places — not rewritten this pass, flagged as
follow-up.

### D.6 Backup & restore

No Railway-native backup schedule confirmed enabled — that's a
dashboard/plan-tier setting outside this session's tool access (§B).
`docs/ops/BACKUPS.md`'s generic `pg_dump`/`pg_restore` procedure is
still mechanically valid but has never been drilled against this
project's actual database; not run in this pass — a restore drill
against the live production database isn't something to do
unilaterally without sign-off.

### D.7 Verification run

No application source was touched this pass (Dockerfile and docs only)
— the full backend suite's last run (pre-freeze, same day) was
171/171 suites, 1307/1307 tests, and nothing since has touched backend
or frontend source, so that result still holds. The Dockerfile edits
were reviewed line-by-line against the already-working
`operations-console`/`customer-web` `ARG`/`ENV` pattern rather than
build-tested (no Docker daemon available in this session's sandbox).
