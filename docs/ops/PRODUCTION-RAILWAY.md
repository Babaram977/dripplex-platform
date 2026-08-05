# Production infrastructure — Railway (canonical)

> **REINSTATED (2026-08-03):** The founder briefly evaluated moving to a
> self-hosted Coolify instance (see `docs/ops/PRODUCTION-COOLIFY.md`), but
> after confirming this Railway deployment is live and healthy (backend,
> Postgres, Redis, customer-web, admin-portal all verified reachable), the
> founder decided to **continue with Railway as production until an
> intentional future migration**. Coolify's runbook is kept as a parked
> reference, not deleted — do not silently switch back to it. Railway is
> the canonical target as of this update.
>
> **RECONFIRMED AND LOCKED (2026-08-05):** Following the Merchant Phase 2
> production audit (`docs/DPX-MERCHANT-013-PRODUCTION-AUDIT.md`), which
> incorrectly cited Coolify's parked doc as the deployment target to
> extend, the founder explicitly reconfirmed: **Railway is the canonical
> production deployment platform for DrippleX.** All future deployment
> work — documentation, runbooks, Docker configuration, environment
> setup, health checks, production verification — targets Railway.
> Coolify's doc remains parked/legacy reference only, per the note above;
> treat it as historical, not as a live alternative to weigh against
> Railway. Going forward, deployment guides and production audits should
> assume Railway unless the founder explicitly decides to change
> platforms again.
>
> The founder also locked the following as the required scope for a
> **Railway-specific production readiness checklist, to be completed
> before Ride launch** (not yet started as of this update — recorded here
> so the scope isn't lost, to be picked up as its own dedicated pass):
> backend deployment; customer-web; driver-portal; merchant-portal;
> operations-console; environment variables and secrets; PostgreSQL and
> Redis connectivity; health/readiness endpoints; domain and SSL
> configuration; monitoring and logging; production build/start
> verification; rollback procedure.

**Status of this document:** Railway was chosen as the single production infrastructure target on 2026-07-28, following `docs/AUDIT-PRODUCTION-READINESS.md`, replacing the Cloudflare Workers / Hetzner / GHCR design in `docs/archive/pre-railway-infrastructure/`. Everything below marked **Verified** was confirmed hands-on in an earlier working session (live `curl` against the deployed API, not assumption) or via the founder's own browser screenshots (2026-08-03: backend `/api/v1/health` returned healthy with database and redis both `up`; customer-web and admin-portal loaded correctly). Everything marked **Not yet verified this session** needs a fresh check — Railway state can drift independently of this repo.

## What's actually running (Verified, as of last confirmed check)

| Service                               | Platform                | Status                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (`@dripplex/backend`, NestJS) | Railway                 | Verified live 2026-08-03 — `/api/v1/health` returned `{"status":"ok","checks":{"database":{"status":"up"},"redis":{"status":"up"}}}`                                                                                                                                                                                                                          |
| PostgreSQL                            | Railway (managed addon) | Verified — connected, backend health check confirms it                                                                                                                                                                                                                                                                                                        |
| Redis                                 | Railway (managed addon) | Verified — connected, backend health check confirms it                                                                                                                                                                                                                                                                                                        |
| `customer-web`                        | Railway                 | Verified live 2026-08-03 — homepage loads at `dripplexcustomer-web-production.up.railway.app`                                                                                                                                                                                                                                                                 |
| `admin-portal`                        | Railway                 | Verified live 2026-08-03 — login page loads at `dripplexadmin-portal-production.up.railway.app`                                                                                                                                                                                                                                                               |
| `driver-portal`                       | Railway                 | **Not deployed** — no Railway service/domain exists for it yet (confirmed 2026-08-03: hitting its expected URL returns Railway's "no deployment" page, not an app error). A Dockerfile now exists (`apps/driver-portal/Dockerfile`, added for the Coolify pass but equally usable here) — deploying it follows the exact same recipe as `admin-portal` below. |
| `operations-console`                  | Railway                 | **Not deployed** — same situation as `driver-portal`. A Dockerfile now exists (`apps/operations-console/Dockerfile`, added for the DPX-OPS-001 module-closure audit, 2026-08-05) — deploying it follows the exact same recipe as `admin-portal` below, see "Deploying `operations-console` to Railway" further down.                                          |
| `merchant-portal`, `rider-portal`     | —                       | Not deployed anywhere. No blocker to deploying them the same way as `customer-web`/`admin-portal` once needed.                                                                                                                                                                                                                                                |
| `customer-mobile`                     | —                       | Not applicable to Railway — it's a Capacitor shell that loads `customer-web`, not an independently deployable service. Store submission is separately gated (see `docs/AUDIT-PRODUCTION-READINESS.md` §5).                                                                                                                                                    |

### Deploying `driver-portal` to Railway (next step)

Same pattern as `customer-web`/`admin-portal`: new Railway service → this repo
→ Dockerfile builder → `apps/driver-portal/Dockerfile` → root build context.
Set `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_APP_URL` build args and
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`NEXT_PUBLIC_CUSTOMER_APP_URL` env vars per
`apps/driver-portal/.env.example` (see `docs/ops/PRODUCTION-COOLIFY.md` §3 for
the exact variable table — same values apply regardless of platform). Set
`PORT=3005` explicitly (the Railway healthcheck-prober gotcha below applies
here too). Attach a public domain once deployed so it's reachable.

### Deploying `operations-console` to Railway (next step)

Same pattern again: new Railway service → this repo → Dockerfile builder →
`apps/operations-console/Dockerfile` → root build context. Build args:
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (same key as customer-web/driver-portal —
see `apps/operations-console/.env.example`; the Live Fleet Map falls back to
a list-only view if this is left unset, so it's optional for a first deploy,
required for the map to actually render). No Firebase/push configuration
applies — `operations-console` doesn't register for push anywhere in the app
(confirmed via the module-level production audit, 2026-08-05). Set
`PORT=3005` explicitly (the same healthcheck-prober gotcha below applies).
Attach a public domain once deployed — the backend's CORS allowlist already
includes an `https://ops.dripplex.com` placeholder
(`infrastructure/secrets/.env.production.example`), so pointing the real
domain there (or updating `CORS_ORIGINS` to whatever domain is actually
chosen) is the only backend-side change needed.

**Production deployment verification, once a service exists:** confirm the
health path the same way `customer-web`/`admin-portal` were verified above —
the homepage/login screen loads over HTTPS, `NEXT_PUBLIC_API_BASE_URL` points
at the real backend (log in as an `operations_staff`/`administrator` user and
confirm the Live Fleet Map, a queue list, and one Analytics page all load
real data, not just the shell), and the Live Fleet Map degrades to its
list-only view rather than crashing if the Maps key isn't set yet.

## Configuration that works (Verified)

- **Builder:** Dockerfile per app (`apps/backend/Dockerfile`, `apps/customer-web/Dockerfile`, `apps/admin-portal/Dockerfile`) — Railway's Railpack auto-builder does not work for this pnpm-workspace monorepo and must be explicitly overridden to Dockerfile mode per service.
- **`DATABASE_URL`:** must be composed from Postgres's individual component variables, not the platform's pre-built `${{Postgres.DATABASE_URL}}` reference (that one resolved to `localhost` incorrectly at the time this was debugged):
  ```
  postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
  ```
- **`PORT`:** must be set explicitly (`PORT=3000`) as its own variable. Railway's healthcheck prober reads `PORT` specifically, separate from the domain's "Target Port" networking setting — the app can be listening correctly and still fail healthchecks if only `API_PORT` (the app's own config var) is set without also setting `PORT`.
- **Migrations on deploy:** backend's `preDeployCommand` runs `node_modules/.bin/prisma migrate deploy` before each deploy. This requires `prisma` to be in `dependencies`, not `devDependencies` — `pnpm prune --prod` (used in the Docker runtime stage) drops `devDependencies`, which would otherwise silently remove the Prisma CLI and make every future deploy's migration step a no-op. (This was the root cause of a production crash loop before it was caught — the app boots fine without a migrated schema, but the first request that touches a missing table crashes the process.)
- **Workspace package builds:** `@dripplex/types`, `@dripplex/utils`, `@dripplex/sdk` are dist-based workspace packages — each app's Dockerfile must explicitly run `pnpm --filter <pkg> build` for all three before building the app itself, or the build fails with `Cannot find module '@dripplex/types'`.
- **Variables set via Raw Editor:** the Raw Editor replaces the _entire_ variable set for a service, not just the edited key. Always paste the complete variable block, never a partial edit, or you'll silently drop unrelated variables (this happened once — lost `REDIS_URL`/JWT secrets while only trying to fix `DATABASE_URL`).

## Known gaps (not yet done, as of this document)

- Nothing from Reality Stage R1.1 (Product Catalog schema), R1.2 (Merchant API), or R1.3 (Customer API) was deployed here before this document was superseded. (A prior note claimed that work lived unmerged on `claude/dripplex-coolify-deploy-fatig4` — as of 2026-08-02 that branch does not exist on `origin`, so that claim could not be verified and is not carried forward. R1.1–R1.3 landed on `ride-002-implementation`/`main` through their own normal merges; check git history there, not this branch name, if you need that work.)
- `merchant-portal`, `rider-portal` have never been deployed anywhere, and have no Dockerfile-based deploy recipe documented yet.
- `operations-console` has never been deployed anywhere either, but as of the DPX-OPS-001 module-closure audit (2026-08-05) it now has a real Dockerfile (`apps/operations-console/Dockerfile`) and a documented deploy recipe (above) — the remaining step is actually creating the Railway service and pointing a domain at it, not writing the recipe.
- No custom domain confirmed attached (verified access was via Railway-generated domains) — production domains (`www.dripplex.com`, `api.dripplex.com`, etc.) referenced in the archived docs were never actually pointed at this infrastructure.
- No monitoring/alerting/log aggregation has been set up for the Railway services specifically — the archived Prometheus/Grafana/Loki design assumed self-hosted infrastructure and doesn't transfer directly. Railway has built-in logs/metrics; whether that's sufficient or something more is wanted is an open question, not yet decided.
- Backup/restore strategy for Railway's managed Postgres has not been documented or tested (`docs/ops/BACKUPS.md` has generic `pg_dump` guidance that still applies conceptually, but nothing Railway-specific has been verified).

## Before treating this as launch-ready

Re-verify the "Verified" table above is still true (Railway state can drift independently of this repo), get R1.1–R1.3 actually migrated and deployed here, and work through the gaps above. See `docs/AUDIT-PRODUCTION-READINESS.md` for the full picture and `docs/REALITY-STAGE-R1.3.md` for what's shipped so far.
