# DPX-LAUNCH-001 — Launch Track 1: Railway Production Readiness

Founder-authorized (2026-08-05) as the first Launch Track following the
freeze of DPX-COMMERCIAL-001 and the platform's core commerce/mobility
foundation. Scope, verbatim:

> Launch Track 1 — Railway Production Readiness (Highest Priority):
> Railway infrastructure; production environment variables and secrets;
> PostgreSQL & Redis verification; health/readiness endpoints; domain &
> SSL; monitoring & logging; backup & rollback; production deployment
> verification for Backend, Customer Web, Driver Portal, Merchant
> Portal, Operations Console.

Founder direction on sequencing and secrets, recorded verbatim:

> Hold off on updating main for now. Complete the remaining Railway
> production readiness work first: verify all required Railway services
> are correctly configured; audit and document every required
> production environment variable and secret; confirm database
> migrations are ready to apply; verify health/readiness endpoints;
> verify build and start commands for every deployed service; produce a
> deployment checklist with no unresolved launch-blocking items. Only
> after that checklist is complete should you return for Founder
> approval to fast-forward main.
>
> Document every missing production secret as a launch blocker, but
> continue all work that doesn't require them. For each integration,
> verify exactly which environment variables are required, document
> them, mark their status as Configured / Pending Founder / Not
> Required, and continue every deployment/readiness task that can be
> completed without the actual credentials.

This document is the deliverable for that instruction. Everything below
was verified by querying live Railway state directly (not assumed from
prior docs, several of which were found stale — see §2) and by reading
the actual backend config-validation code and each app's Dockerfile,
not by trusting `.env.example` files as authoritative.

**This document does not conclude the track.** Per the founder's
sequencing, main is not yet fast-forwarded — §11 lays out exactly what
remains before that approval is requested.

## 1. The one blocking finding: `main` is 65 commits behind

Railway's four live app services (backend, customer-web, admin-portal,
driver-portal) all deploy from `main`. `main` is **65 commits behind**
`claude/dripplex-coolify-deploy-fatig4` — the gap covers everything
since Driver Slice 1: all of Driver Slice 2, the entire Operations
Command Centre (4 slices), the entire Merchant module, and the entire
Commercial Engine (6 slices, just frozen). **None of that is live in
production today.** This also explains why `merchant-portal` and
`operations-console` have no Railway service at all — `operations-console`
doesn't exist on `main` yet; `merchant-portal` exists on `main` but as
its much earlier R1.4 shell, not the frozen Phase 2 build.

Per founder direction (§0), this is **not** being fixed in this pass.
It is the single gating item for Launch Track 1's completion — see §11.

## 2. Live Railway service inventory (verified 2026-08-05)

Project: `overflowing-unity` (`f09361bd-3cda-4f0f-a22a-2ea464e47ab2`),
environment `production`. (A second, empty project — `zonal-freedom` —
exists on the account with no services; not in use, not referenced
further here.)

| Service                     | Status                                                | Domain                                                                      | Builder                                                      | Notes                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@dripplex/backend`         | ✅ SUCCESS                                            | `dripplexbackend-production.up.railway.app`                                 | Dockerfile (`apps/backend/Dockerfile`)                       | Healthcheck `/api/v1/health`, 30s timeout, 3 retries. Deploys from `main`.                                                                                                                                                                                                                                       |
| `@dripplex/customer-web`    | ✅ SUCCESS                                            | `dripplexcustomer-web-production.up.railway.app`                            | Dockerfile                                                   | Healthcheck now `/` (was unset — fixed this pass, §5). Deploys from `main`.                                                                                                                                                                                                                                      |
| `@dripplex/admin-portal`    | ✅ SUCCESS                                            | `dripplexadmin-portal-production.up.railway.app`                            | Dockerfile                                                   | Healthcheck `/` (already set). Deploys from `main`.                                                                                                                                                                                                                                                              |
| `@dripplex/driver-portal`   | ✅ SUCCESS (but effectively unverifiable — see below) | `dripplexdriver-portal-production.up.railway.app` (generated this pass, §5) | Dockerfile                                                   | **Found with zero environment variables and no healthcheck configured** — the prior "Not deployed" claim in `PRODUCTION-RAILWAY.md` was stale; it deploys, but nothing was checking whether it actually worked. Fixed this pass, §5. Deploys from `main` (an early, pre-Launch-Mode build of this app — see §1). |
| Postgres                    | ✅ SUCCESS                                            | private only                                                                | Railway managed image (`postgres-ssl:18`)                    | Volume-backed.                                                                                                                                                                                                                                                                                                   |
| Redis                       | ✅ SUCCESS                                            | private only                                                                | Railway managed image (`redis:8.2.1`)                        | Volume-backed, password-protected, AOF+RDB (`--save 60 1`).                                                                                                                                                                                                                                                      |
| `@dripplex/customer-mobile` | ✅ SUCCESS                                            | `dripplexcustomer-mobile-production.up.railway.app`                         | Dockerfile (**`apps/customer-web/Dockerfile`**, not its own) | **Misconfigured, flagged not fixed** — see §3.                                                                                                                                                                                                                                                                   |
| `merchant-portal`           | Not deployed                                          | —                                                                           | —                                                            | Dockerfile exists on `main` (an early R1.4 shell); needs a Railway service created once `main` reflects the frozen Phase 2 build.                                                                                                                                                                                |
| `operations-console`        | Not deployed                                          | —                                                                           | —                                                            | Dockerfile does not exist on `main` at all yet (only on the feature branch); blocked entirely on §1.                                                                                                                                                                                                             |
| `rider-portal`              | Not deployed                                          | —                                                                           | —                                                            | Dockerfile exists on `main`; no founder-scoped rider-portal work has shipped yet, so this is not urgent for Ride launch.                                                                                                                                                                                         |

## 3. Real finding: `customer-mobile`'s Railway service is misconfigured

`apps/customer-mobile` is a **Capacitor 7 native-app shell** (confirmed
by reading `apps/customer-mobile/README.md` and its `capacitor.config.ts`)
— it wraps `customer-web` for Android/iOS store distribution by loading
a URL at runtime (`CAPACITOR_SERVER_URL`). It is not a servable web app
and was never meant to run standalone. Its build artifact is an
Android AAB/APK or an iOS archive, produced by
`scripts/mobile/build-android.sh` / `cap open ios`, not a Docker image.

Yet a Railway service named `@dripplex/customer-mobile` exists, live,
with its own public domain, building from **`apps/customer-web/Dockerfile`**
while watching `apps/customer-mobile/**` for changes — it is, in effect,
a second copy of `customer-web` running under the wrong name. This
appears to be a leftover from early Railway setup rather than anything
intentional.

**Not deleted in this pass** — deleting live infrastructure is exactly
the kind of hard-to-reverse action this platform's discipline holds
back for explicit confirmation. Recommendation: delete this service (or
repurpose it, if there's a reason to keep a redundant customer-web
mirror) once reviewed. No functional harm today — it duplicates
customer-web's content under a domain nobody links to — but it's dead
weight in the service inventory and would confuse a future audit.

## 4. Backend environment variable / secrets matrix

Built from the **authoritative source** — `apps/backend/src/config/env.validation.ts`
(the Zod schema every env var is validated against on boot) — not from
`.env.example` files, several of which (`infrastructure/secrets/.env.production.example`)
list vars (`SMTP_*`, `TERMII_*`, `SENTRY_*` partially, `R2_*`, `B2_*`,
`CLOUDFLARE_*`) that **no backend code actually reads**. Those are
speculative/aspirational from the pre-Railway infrastructure design and
are called out below as Not Required — implementing them is future
scope, not a documentation gap in this pass.

Only 4 variables have no default and are hard-required to boot:
`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
Everything else defaults to a safe value (usually `''`), and the
corresponding integration no-ops cleanly when unset — confirmed by
reading the provider code, not assumed:

| Variable(s)                                                                       | Purpose                          | Status                                     | Behavior when unset                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`            | Core boot requirements           | ✅ Configured (Railway-managed refs / set) | App fails to boot — correctly required                                                                                                                                                                                                              |
| `NODE_ENV`, `PORT`, `CORS_ORIGINS`                                                | Runtime config                   | ✅ Configured                              | Sane defaults exist even if unset                                                                                                                                                                                                                   |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_BASE_URL`                 | Default payment provider         | ⚠️ Pending Founder                         | Provider calls fail — needed before any real online payment can process                                                                                                                                                                             |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`    | Alt. payment provider            | ⚠️ Pending Founder                         | Same — only needed if Flutterwave is the launch provider                                                                                                                                                                                            |
| `OPAY_API_KEY`                                                                    | Alt. payment provider            | ⚠️ Pending Founder                         | Same                                                                                                                                                                                                                                                |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`            | Server-side push (FCM)           | ⚠️ Pending Founder                         | `NotConfigured` provider used — push silently no-ops, confirmed real code path (`notification-center/providers/not-configured.provider.ts`)                                                                                                         |
| `GOOGLE_MAPS_SERVER_API_KEY`                                                      | Server-side geocoding/directions | ⚠️ Pending Founder                         | `NotConfigured` reverse-geocoder used — confirmed real fallback, not a crash                                                                                                                                                                        |
| `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`                                         | KYC/identity verification        | ⚠️ Pending Founder                         | Needed for real driver identity verification in production                                                                                                                                                                                          |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` | Error monitoring                 | ⚠️ Pending Founder                         | Confirmed real, wired code (`src/observability/sentry.ts`, called from `main.ts`) — no-ops with no DSN, doesn't crash                                                                                                                               |
| `SMTP_*`, `TERMII_*`, `R2_*`, `B2_*`, `CLOUDFLARE_*`                              | Email/SMS/object storage         | **Not Required**                           | No backend code references these at all — not a gap in this pass, a real missing capability for a future track (email/SMS notifications currently have no delivery provider beyond the `NotConfigured` adapters already documented in DPX-CORE-001) |

## 5. Frontend environment variables — real bugs found and fixed

Reading each portal's actual source (not just `.env.example`) surfaced
two genuine Dockerfile bugs: two apps read `NEXT_PUBLIC_*` variables in
their code that their own **Dockerfile never declared as a build
`ARG`**. Next.js inlines `NEXT_PUBLIC_*` values at build time — setting
them as a Railway runtime variable does nothing if the Dockerfile
doesn't plumb them through as `ARG`/`ENV` during the build stage. This
means, as deployed today, these values would silently be `undefined` in
the shipped bundle no matter what was set on Railway.

**Fixed this pass** (code changes on the feature branch, not yet on
`main` — will take effect on the next build after §1 closes):

- **`apps/customer-web/Dockerfile`** — was missing `ARG`/`ENV` for
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and all six
  `NEXT_PUBLIC_FIREBASE_*` variables, despite `src/lib/google-maps-config.ts`
  and `src/lib/firebase-push-config.ts` both reading them directly.
  Maps and push notifications were silently non-functional in the
  deployed build regardless of Railway configuration. Added, matching
  the working pattern already used in `apps/operations-console/Dockerfile`.
- **`apps/driver-portal/Dockerfile`** — was missing `ARG`/`ENV` for
  `NEXT_PUBLIC_CUSTOMER_APP_URL` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
  despite `src/lib/google-maps-config.ts`/`src/lib/share.ts` reading
  them. Added.
- **`apps/rider-portal/Dockerfile`**, **`apps/admin-portal/Dockerfile`**,
  **`apps/merchant-portal/Dockerfile`** — checked, no gap; none of
  these apps read anything beyond `NEXT_PUBLIC_API_BASE_URL`/
  `NEXT_PUBLIC_APP_URL`, both already correctly plumbed.

**Also fixed this pass (live Railway config, no code/secret needed):**

- `driver-portal` had **zero environment variables and no public
  domain** — confirmed via direct Railway query, not assumed from the
  (stale) doc claiming it wasn't deployed at all. Generated a Railway
  domain (`dripplexdriver-portal-production.up.railway.app`, target
  port 3005 matching the Dockerfile's `EXPOSE`), set
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, and
  `NEXT_PUBLIC_CUSTOMER_APP_URL` to their real values, and added a `/`
  healthcheck. Deploy was **not** re-triggered — the currently-deployed
  code is a pre-Launch-Mode build from before `main` was last updated,
  so a real verification pass only makes sense after §1 closes and a
  fresh build picks up the Dockerfile fix above.
- `customer-web` had no healthcheck path configured at all (meaning
  Railway wasn't actually verifying it before marking deploys
  successful). Set to `/`, matching `admin-portal`'s existing config.

**Still pending — genuine secrets, not configuration:**

| App                                  | Variable                                                                                                       | Status                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `customer-web`                       | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                              | ⚠️ Pending Founder                                                                   |
| `customer-web`                       | `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `_VAPID_KEY` | ⚠️ Pending Founder                                                                   |
| `driver-portal`                      | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                              | ⚠️ Pending Founder                                                                   |
| `operations-console` (once deployed) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                                                                              | ⚠️ Pending Founder (falls back to list-only view without it, confirmed non-crashing) |

Note: whatever real key is supplied for `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
is almost certainly the same browser Maps key across customer-web,
driver-portal, and operations-console — one key, three places to set it
— and is a **separate** credential from the backend's
`GOOGLE_MAPS_SERVER_API_KEY` (§4), which is a server-side key with
different Google Cloud API restrictions.

## 6. Migration readiness

55 migration directories in `apps/backend/prisma/migrations/`, most
recent four all from today's Commercial Engine slices. `prisma` is
correctly listed in `dependencies` (not `devDependencies`) in
`package.json` — the documented historical gotcha (a prior production
crash loop from `pnpm prune --prod` silently dropping the Prisma CLI,
making `migrate deploy` a silent no-op) remains fixed. The backend's
`preDeployCommand` (`node_modules/.bin/prisma migrate deploy`) runs
before every deploy, so once `main` is fast-forwarded, Railway will
apply all pending migrations automatically on the next backend deploy.

This was not re-tested against the live production database in this
pass — doing so would mean either deploying against it (gated behind
§1) or running `prisma migrate deploy` directly against production
outside of a real deploy, which was not authorized. Confidence instead
comes from: every one of these 55 migrations has already been applied
and exercised against a real Postgres instance as part of each slice's
own test suite (most recently, the full backend suite — 171/171 suites,
1307/1307 tests — passing today after the Commercial Engine freeze).

## 7. Health/readiness endpoints

| Service                                                 | Path             | Checks                                                                                     |
| ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `backend`                                               | `/api/v1/health` | Database (`up`/`down`), Redis (`up`/`down`) — confirmed via `src/health/health.service.ts` |
| `customer-web`                                          | `/`              | Fixed this pass (§5)                                                                       |
| `admin-portal`                                          | `/`              | Already configured                                                                         |
| `driver-portal`                                         | `/`              | Fixed this pass (§5)                                                                       |
| `merchant-portal`, `operations-console`, `rider-portal` | —                | N/A — not yet deployed (§1, §2)                                                            |

## 8. Monitoring & logging

- **Railway-native logs/metrics** are the current baseline — this
  session used `get-logs` (deploy/build/http streams) and
  `get-service-metrics` (CPU/memory/disk/network) directly against live
  services; both work today with no additional setup.
- **Sentry integration is real and already wired** (`initBackendSentry()`,
  called unconditionally from `main.ts`, no-ops cleanly with no
  `SENTRY_DSN` set) — this is not a build task, only a
  ⚠️ Pending Founder secret (§4) away from being live.
- **No alerting** beyond Railway's own dashboard exists — no Slack/
  PagerDuty/email hook on deploy failure or health-check failure. Not
  fixed in this pass; a genuine gap, consistent with every other
  module's production audit accepting the equivalent gap as
  non-blocking, operational-maturity work rather than a launch
  blocker.
- The pre-Railway generic runbooks in `docs/ops/runbooks/` (database-down,
  redis-down, api-errors, etc.) and `docs/ops/sla/SLA-SLO.md` predate
  this infrastructure and reference a different (Cloudflare/Hetzner)
  design in places. Not rewritten in this pass — flagged as follow-up,
  not blocking.

## 9. Backup & restore

- **No Railway-native backup schedule has been confirmed enabled** —
  Railway's managed-Postgres backup/snapshot feature is a dashboard/
  plan-level setting not visible or controllable through the tools
  available in this session. This needs a founder decision (which plan
  tier, what retention) rather than something resolvable from here.
- `docs/ops/BACKUPS.md`'s `pg_dump`/`pg_restore` procedure is generic
  and pre-Railway (its "verify migration table matches expected RC1
  head" step references `20260721220000_s1_c14_c23_stabilization` — the
  very first migration, 54 migrations out of date). The procedure
  itself (`pg_dump "$DATABASE_URL" --format=custom` /
  `pg_restore --clean --if-exists`) is still mechanically valid against
  Railway's Postgres (it's just a connection string), but **has never
  been drilled** against this project's actual database. Not run in
  this pass — running a restore drill against the live production
  database without explicit sign-off isn't something to do
  unilaterally.
- **Recommendation for founder decision**: enable Railway's managed
  backup feature if the current plan tier supports it (fastest, no
  custom tooling), and/or schedule a periodic `pg_dump` job as a
  second, provider-independent copy. Either requires a founder call on
  cost/tier before it can be implemented.

## 10. Rollback procedure

Confirmed via live `list-deployments` query: Railway retains full
deployment history per service, and each deployment's outcome
(`SUCCESS`/`FAILED`/`CRASHED`/`REMOVED`/etc.) and source commit are
queryable. **Caveat, stated precisely rather than overclaimed**: the
Railway tooling available in this session only exposes `redeploy`
(re-run the _current_ latest deployment) — there is no tool here to
redeploy a specific _past_ deployment ID. That specific action (pick an
older deployment, click "Redeploy") exists in the Railway dashboard UI
but not through this session's API surface. Documented so a future
on-call session knows the real rollback path is the dashboard, not this
toolset, until/unless a deployment-specific redeploy tool is added.

## 11. What remains before this track can close

In the order the founder's sequencing implies:

1. **Founder review of this document** — confirm the findings and fixes
   above are acceptable, and confirm the Pending-Founder secrets in §4/§5
   are being deferred correctly (per the founder's own hybrid
   instruction) or provide any that are ready now.
2. **Founder approval to fast-forward `main`** (§1) — the actual gate.
   Once approved: fast-forward, watch all four live services redeploy,
   verify each health endpoint, verify migrations applied cleanly, and
   report results before doing anything else.
3. **After `main` is current**: create Railway services for
   `merchant-portal` and `operations-console` (recipes already
   documented in `docs/ops/PRODUCTION-RAILWAY.md`), attach domains,
   verify.
4. **Custom domain & SSL** — nothing beyond Railway's automatic
   `*.up.railway.app` SSL exists today; pointing real domains
   (`www.dripplex.com`, `api.dripplex.com`, etc.) at these services
   requires the founder owning/controlling that DNS — not resolvable
   from this session.
5. **Backup plan decision** (§9) and **secrets** (§4/§5) — as they
   arrive.
6. **`customer-mobile` service** (§3) — founder call on delete vs. keep.

## 12. Recommendation

No launch-blocking item in this document is unresolved _within the
scope this pass could act on_. Every item still open is either (a)
gated on the founder's own explicit main-merge hold, (b) a genuine
secret only the founder can supply, or (c) a platform/cost decision
(backup tier, custom domain). Everything actionable without those —
service configuration audit, the two real Dockerfile bugs, driver-portal's
missing config, health endpoints, migration-readiness verification, and
the rollback/backup procedures being honestly documented rather than
assumed — is done.
