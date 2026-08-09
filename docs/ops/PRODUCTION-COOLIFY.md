> ⚠️ **SUPERSEDED / parked.** Production runs on Cloudflare Workers + GHCR/VPS
> Docker Compose. See **`docs/ops/DPX-LAUNCH-008-DEPLOYMENT-RECONCILIATION.md`**
> for the authoritative architecture. Retained for history.

# Production infrastructure — Coolify (parked, not canonical)

> **PARKED (2026-08-03):** This was briefly the intended production target
> (2026-08-02) before the founder confirmed the existing Railway deployment
> is live and healthy and decided to **continue with Railway until an
> intentional future migration** — see `docs/ops/PRODUCTION-RAILWAY.md`,
> which is canonical again. This document is kept, not deleted, since the
> runbook below is still accurate and directly reusable if/when a real
> migration to Coolify happens. Do not act on this document unless the
> founder explicitly says to resume the Coolify migration.

**Status of this document:** Coolify was briefly the intended production
deployment target (2026-08-02), evaluated as a replacement for Railway (see
`docs/ops/PRODUCTION-RAILWAY.md`, canonical again as of 2026-08-03).
Rationale for having considered it: the founder owns a VPS, so it would
avoid platform lock-in and give direct control over scaling/networking/costs
as DrippleX grows into a multi-service platform (Ride, Marketplace,
Delivery). That rationale still holds if a migration is revisited later —
it just isn't the active plan right now.

This document has **not been executed against a live Coolify instance from
this session** — the sandbox this was written in has no Coolify CLI/API
access, and Coolify itself is a self-hosted dashboard on the founder's own
server, not something reachable by URL guessing. Everything below is a
concrete, ready-to-follow runbook prepared from the repo's actual Dockerfiles
and env contracts, the same collaborative pattern already used for Google
Maps and Paystack credentials: the founder drives the Coolify dashboard,
pasting in the values this document specifies.

## 0. Prerequisites (founder-side, one-time)

1. A VPS with Coolify installed (Coolify's own installer:
   `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`). Minimum
   ~4 vCPU / 8GB RAM to comfortably run backend + 3 Next.js apps + Postgres +
   Redis on one box; split across multiple Coolify-managed servers later if
   needed — Coolify supports that without changing anything below.
2. DNS control for `dripplex.com` pointed at that VPS (or at Coolify's own
   Traefik-fronted IP). Suggested subdomain scheme, reusing the names
   already chosen in `infrastructure/nginx/dripplex.conf`:
   - `api.dripplex.com` → backend
   - `app.dripplex.com` (or `www.dripplex.com`) → customer-web
   - `driver.dripplex.com` → driver-portal (the actively developed app —
     see note in §3 on why this isn't `rider-portal`)
   - `admin.dripplex.com` → admin-portal
3. This repo connected to Coolify as a GitHub source (Coolify's GitHub App,
   or a deploy key) so it can pull `claude/dripplex-coolify-deploy-fatig4`
   (or whatever branch/tag you promote to production) directly — no need to
   push images to a registry first.

Coolify's built-in Traefik reverse proxy handles TLS (Let's Encrypt,
auto-renewed) and per-app domain routing itself. The `infrastructure/nginx/`
config and `infrastructure/docker/docker-compose.production.yml` files in
this repo predate both Railway and Coolify (they're the original
self-hosted-Docker-Compose design) — they are not needed for a Coolify
deploy and are left untouched as historical reference, not wired into this
runbook.

## 1. Databases — Coolify "Database" resources (not app containers)

Create these as Coolify-managed **Database** resources, not as services
inside an app's compose file — Coolify provisions persistent volumes,
backups, and connection strings for these automatically, which is strictly
better than the hand-rolled `pg_data`/`redis_data` volumes in the archived
`docker-compose.production.yml`.

1. **PostgreSQL 16** — new Database → PostgreSQL. Note the internal
   connection string Coolify generates (host is the internal service name,
   e.g. `postgresql`, not `localhost`). Coolify's databases get a persistent
   volume by default — no extra configuration needed.
2. **Redis 7** — new Database → Redis. Set a password (Coolify prompts for
   one). Same automatic persistent volume.

Compose the real `DATABASE_URL` from what Coolify shows you for the Postgres
resource:

```
postgresql://<user>:<password>@<internal-host>:5432/<database>?schema=public
```

And `REDIS_URL` similarly:

```
redis://:<password>@<internal-host>:6379
```

Do not use `localhost` in either — that was the exact Railway mistake
documented in `docs/ops/PRODUCTION-RAILWAY.md` §Configuration, and it
applies here too: the backend runs in its own container, so `localhost`
inside it means the backend container itself, not the database.

## 2. Backend — Coolify "Application" resource

New Resource → Application → Public/Private Git Repository → this repo,
branch `claude/dripplex-coolify-deploy-fatig4` (or the branch you're
promoting). Build Pack: **Dockerfile**. Dockerfile location:
`apps/backend/Dockerfile`. Build context: repo root (the Dockerfile's
`COPY` paths are root-relative, e.g. `COPY apps/backend apps/backend` — do
not set the build context to `apps/backend/`, it will fail to find
`packages/`).

**Port:** the Dockerfile already `EXPOSE`s 3000 and the app listens on
`API_PORT`/`API_HOST` from env — set Coolify's "Ports Exposes" to `3000`
and let Coolify's proxy map your domain to it.

**Health check:** the Dockerfile already declares a Docker
`HEALTHCHECK` hitting `http://127.0.0.1:3000/api/v1/health` — Coolify reads
this automatically. If you want it configured explicitly in the Coolify UI
too, use path `/api/v1/health`, port `3000`.

**Pre/post-deploy command (migrations):** set a "Post-deployment command"
(Coolify's equivalent of Railway's `preDeployCommand` — for backend it's
safer to run migrations _after_ the new image is up but _before_ traffic
routes to it, which is what Coolify's deploy-then-healthcheck flow does) to:

```
pnpm exec prisma migrate deploy
```

run from `/app/apps/backend` (the Dockerfile's final `WORKDIR`). This works
unmodified because `prisma` is already in `apps/backend/package.json`'s
`dependencies` (not `devDependencies`) — the exact fix that prevented a
silent-migration-skip crash loop on Railway, still in effect here since it's
the same Dockerfile.

**Environment variables** (Coolify → this app → Environment Variables — add
each individually, not as a single raw paste, to avoid the "raw editor wipes
everything" mistake documented for Railway):

| Variable                                                                                                                                                                   | Value                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                                                                                 | `production`                                                                                                                                                                                       |
| `DATABASE_URL`                                                                                                                                                             | from §1                                                                                                                                                                                            |
| `REDIS_URL`                                                                                                                                                                | from §1                                                                                                                                                                                            |
| `API_HOST`                                                                                                                                                                 | `0.0.0.0`                                                                                                                                                                                          |
| `API_PORT`                                                                                                                                                                 | `3000`                                                                                                                                                                                             |
| `API_GLOBAL_PREFIX`                                                                                                                                                        | `api/v1`                                                                                                                                                                                           |
| `CORS_ORIGINS`                                                                                                                                                             | `https://app.dripplex.com,https://driver.dripplex.com,https://admin.dripplex.com` (add `https://www.dripplex.com` too if that's a separate origin from `app.dripplex.com`)                         |
| `JWT_ACCESS_SECRET`                                                                                                                                                        | generate a real 32+ char secret (`openssl rand -base64 48`), never reuse the `.env.example` placeholder                                                                                            |
| `JWT_REFRESH_SECRET`                                                                                                                                                       | same, a _different_ generated secret                                                                                                                                                               |
| `JWT_ACCESS_TTL`                                                                                                                                                           | `15m`                                                                                                                                                                                              |
| `JWT_REFRESH_TTL`                                                                                                                                                          | `7d`                                                                                                                                                                                               |
| `PAYSTACK_SECRET_KEY`                                                                                                                                                      | `sk_test_c48b7e7abfb28d33ca5daa1c0cdcfb3608f0af8d` (Test Mode — see `docs/PAYSTACK-INTEGRATION.md`; swap for a Live key post-launch)                                                               |
| `PAYSTACK_PUBLIC_KEY`                                                                                                                                                      | `pk_test_76915d525ca49ba77796588836998ab02ed54a7ff`                                                                                                                                                |
| `PAYSTACK_BASE_URL`                                                                                                                                                        | `https://api.paystack.co`                                                                                                                                                                          |
| `PAYMENT_DEFAULT_PROVIDER`                                                                                                                                                 | `PAYSTACK`                                                                                                                                                                                         |
| `GOOGLE_MAPS_SERVER_API_KEY`                                                                                                                                               | the server-side Maps key from `.env.example` (restrict to Geocoding API + this server's IP in Google Cloud Console once the IP is static — see `docs/LAUNCH-READINESS-CREDENTIALS.md`)             |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`                                                                                                   | from the Firebase Admin SDK service account JSON (`private_key` field — keep the literal `\n` escapes exactly as downloaded); leave blank to keep push on `NotConfiguredProvider` if not ready yet |
| `LOG_LEVEL`                                                                                                                                                                | `info`                                                                                                                                                                                             |
| `SENTRY_DSN`                                                                                                                                                               | leave blank unless Sentry is set up for this environment                                                                                                                                           |
| all `OTP_*`, `BCRYPT_SALT_ROUNDS`, `LOGIN_MAX_ATTEMPTS_*`, `THROTTLE_*`, `SESSION_*`, `PASSWORD_RESET_*`, `EMAIL_VERIFICATION_*`, `PHONE_OTP_*`, `IDENTITY_VERIFICATION_*` | copy the defaults straight from root `.env.example` — none of these are Coolify-specific                                                                                                           |

Once this app has a Coolify-assigned domain (`api.dripplex.com`), come back
and set:

- Paystack Dashboard → Settings → API Keys & Webhooks → **Test Webhook URL**:
  `https://api.dripplex.com/api/v1/webhooks/paystack`
- (Flutterwave, if/when enabled): `https://api.dripplex.com/api/v1/webhooks/flutterwave`

Both webhook paths already exist and are real
(`apps/backend/src/payments/payment-webhooks.controller.ts`) — this is
purely a "point the dashboard at the now-real URL" step, no code change
needed. As noted in `docs/PAYSTACK-INTEGRATION.md`, ride payments and wallet
funding verify explicitly and don't depend on this webhook; only
marketplace order payments do.

## 3. Frontend apps — one Coolify "Application" resource each

Same Build Pack (`Dockerfile`), same repo/branch, same root build context
for each. All four below have `output: 'standalone'` gated behind
`DOCKER_BUILD=1` in their `next.config.ts`, which their Dockerfiles already
set — nothing to change there.

### customer-web

- Dockerfile: `apps/customer-web/Dockerfile`
- Port: `3001`
- Build args (Coolify → Build → "Build Variables", since these are `ARG`s
  baked into the Next.js bundle at build time, not runtime env):
  - `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1`
  - `NEXT_PUBLIC_APP_URL=https://app.dripplex.com`
- Runtime env vars (from `apps/customer-web/.env.example`): all the
  `NEXT_PUBLIC_FIREBASE_*` values and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` —
  these are also baked in at build time for a Next.js static/standalone
  build, so set them as Build Variables too, not just runtime env, or the
  compiled bundle won't have them.
- Domain: `app.dripplex.com` (and/or `www.dripplex.com` — Coolify supports
  multiple domains per app).

### driver-portal

- Dockerfile: `apps/driver-portal/Dockerfile` (added this pass — see below)
- Port: `3005`
- Build args:
  - `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1`
  - `NEXT_PUBLIC_APP_URL=https://driver.dripplex.com`
- Runtime/build env vars (from `apps/driver-portal/.env.example`):
  - `NEXT_PUBLIC_CUSTOMER_APP_URL=https://app.dripplex.com` (referral share
    links point here, not at driver-portal itself)
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — same key as customer-web
- Domain: `driver.dripplex.com`.
- **Why `driver-portal`, not `rider-portal`:** `docs/ops/PRODUCTION-RAILWAY.md`
  flagged this as an open question ("overlaps with `rider-portal`, confirm
  with founder"). It's resolved by what's actually been built since: the
  MAPS-UI driver map, live position tracking, and the full Driver Growth
  Campaign UI (8 screens) all live in `apps/driver-portal`, which is real
  and actively maintained. `apps/rider-portal` is an older, separately
  Cloudflare-Workers-targeted app (`opennextjs-cloudflare` build scripts,
  its own `wrangler.jsonc`) that hasn't received any of that work. This
  runbook deploys `driver-portal`; `rider-portal` is left alone.
  `apps/driver-portal/Dockerfile` did not exist before this pass — it's
  new, built by copying `apps/customer-web/Dockerfile`'s exact multi-stage
  pattern (same base image, same workspace-package build order, same
  non-root runtime user) since driver-portal's `next.config.ts` was already
  Docker-ready (`output: 'standalone'` behind `DOCKER_BUILD=1`).

### admin-portal

- Dockerfile: `apps/admin-portal/Dockerfile`
- Port: `3004`
- Build args:
  - `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1`
  - `NEXT_PUBLIC_APP_URL=https://admin.dripplex.com`
- Domain: `admin.dripplex.com`.

### operations-console

- Dockerfile: `apps/operations-console/Dockerfile` (added for the
  DPX-OPS-001 module-closure audit, 2026-08-05 — the console previously
  shipped only Cloudflare Workers tooling, `wrangler.jsonc`, with no Docker
  path at all).
- Port: `3005`.
- Build args:
  - `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1`
  - `NEXT_PUBLIC_APP_URL=https://ops.dripplex.com`
- Runtime/build env vars (from `apps/operations-console/.env.example`):
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — same key as customer-web/
    driver-portal. The Live Fleet Map (Slice 1) falls back to a list-only
    view when unset rather than crashing (`src/lib/google-maps-config.ts`),
    so this is optional for a first deploy, required for the map itself.
  - No Firebase/push variables apply — `operations-console` has no push
    registration anywhere in the app (confirmed by the module-level
    production audit).
- Domain: `ops.dripplex.com` — the backend's `CORS_ORIGINS` template
  (`infrastructure/secrets/.env.production.example`) already includes this
  placeholder, so no backend change is needed once the real domain matches
  it.
- Built by copying `apps/driver-portal/Dockerfile`'s exact multi-stage
  pattern, the same way that Dockerfile was itself copied from
  `apps/customer-web/Dockerfile`.

`merchant-portal`, `rider-portal` are not part of this pass — consistent
with the standing "Phase 1 ride-launch only, no marketplace/merchant/
post-launch work" directive. Their Dockerfiles already exist
(`apps/merchant-portal/Dockerfile`) if/when that changes; deploying them
would follow the exact same recipe as admin-portal above.

## 4. HTTPS

Nothing to configure manually. Once a domain is attached to a Coolify
Application (§2/§3), Coolify's Traefik proxy provisions and renews a Let's
Encrypt certificate for it automatically and terminates TLS there — this
replaces the hand-rolled `origin.pem`/`origin.key` + Cloudflare Full-strict
setup in `infrastructure/nginx/dripplex.conf`. If you still want Cloudflare
in front (orange-cloud proxy for DDoS/CDN), set Cloudflare's SSL mode to
"Full" (not "Full (strict)", unless you also configure Cloudflare Origin
CA certs inside Coolify) and point the DNS `A`/`CNAME` records at the VPS.

## 5. Persistent volumes

- **Postgres, Redis:** handled automatically by Coolify's Database
  resources (§1) — no manual volume configuration.
- **Backend, customer-web, driver-portal, admin-portal:** none needed. A
  repo-wide check for file-upload/local-disk usage (`multer`,
  `diskStorage`, `uploads/`) in `apps/backend/src` found nothing — every
  upload-shaped feature in this codebase either doesn't exist yet or
  already goes through structured data (DB/wallet ledger), not local disk.
  If that changes later (e.g. driver KYC document uploads), that's the
  point to add either a Coolify persistent volume or, better, S3-compatible
  object storage — not before.

## 6. Deploy order (first time)

1. Postgres + Redis Database resources (§1) — these have no dependents yet
   so can't fail on a dependency.
2. Backend Application (§2) — first deploy will run `prisma migrate deploy`
   against a fresh database, applying the full migration history.
3. Once backend's `/api/v1/health` responds healthy at its Coolify domain,
   deploy customer-web, driver-portal, admin-portal (§3) — their build args
   need the backend's real `NEXT_PUBLIC_API_BASE_URL`, so backend having a
   stable domain first avoids a rebuild-just-to-fix-the-URL step.
4. Point the Paystack Test Webhook URL at the live backend domain (§2).
5. Run the real payment tests from `docs/PAYSTACK-INTEGRATION.md` (wallet
   funding, ride payment, verification, webhook delivery) against the live
   URLs — this is the live-verification step that was blocked in the
   sandbox this integration was built in (see that doc's "Status: keys
   wired, live verification blocked" section).

## 7. Known gaps (carried over / new)

- Not yet executed against a real Coolify instance — this is a prepared
  runbook, not a confirmed-live deployment. Treat every "Verified" claim in
  `docs/ops/PRODUCTION-RAILWAY.md` as _not_ transferred; nothing here is
  "Verified" until it's actually been clicked through on the founder's
  Coolify dashboard.
- No monitoring/alerting/log aggregation configured. Coolify has built-in
  container logs and basic resource metrics; whether that's sufficient or
  the archived Prometheus/Grafana/Loki stack (`docs/archive/pre-railway-infrastructure/infrastructure/MONITORING.md`)
  should be reintroduced is an open question, not decided here.
- Backup/restore strategy for Coolify's managed Postgres not yet documented
  or tested (`docs/ops/BACKUPS.md` generic `pg_dump` guidance still applies
  conceptually).
- The pre-existing schema/migration-history drift documented in
  `docs/PAYSTACK-INTEGRATION.md` (`wallet_ledger_entries` unique-index
  rename, `orders_order_number_idx`, `promotions_domains_idx`) is still
  unresolved — a from-scratch `prisma migrate deploy` here will hit the same
  drift Railway would have. Worth a dedicated cleanup pass before treating a
  from-scratch Coolify database as fully reproducible from migration
  history alone.
