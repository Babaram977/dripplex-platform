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
> before Ride launch**: backend deployment; customer-web; driver-portal;
> merchant-portal; operations-console; environment variables and
> secrets; PostgreSQL and Redis connectivity; health/readiness
> endpoints; domain and SSL configuration; monitoring and logging;
> production build/start verification; rollback procedure.
>
> **Launch Track 1 opened (2026-08-05):** this checklist is now underway
> — see `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` for the live
> findings, the table below's corrections (several entries here were
> found stale — `driver-portal` in particular _is_ deployed, just
> unconfigured and unverified), and the current blocking item (`main`
> is 65 commits behind the frozen modules; deployment is on hold for
> founder approval before fast-forwarding).

**Status of this document:** Railway was chosen as the single production infrastructure target on 2026-07-28, following `docs/AUDIT-PRODUCTION-READINESS.md`, replacing the Cloudflare Workers / Hetzner / GHCR design in `docs/archive/pre-railway-infrastructure/`. The table below was **re-verified live against the Railway API on 2026-08-05** as part of Launch Track 1 — see `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` for full detail; that document, not this one, is now the current source of truth for live service state. This table is kept only as a quick-reference summary.

## What's actually running (re-verified 2026-08-05, see DPX-LAUNCH-001-RAILWAY-READINESS.md)

| Service                               | Platform                | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (`@dripplex/backend`, NestJS) | Railway                 | Deployed, healthcheck configured (`/api/v1/health`), deploys from `main` — but `main` is 65 commits behind (see readiness doc §1)                                                                                                                                                                                                                                                                                                                                                                       |
| PostgreSQL                            | Railway (managed addon) | Deployed, volume-backed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Redis                                 | Railway (managed addon) | Deployed, volume-backed, password-protected                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `customer-web`                        | Railway                 | Deployed, healthcheck added this pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `admin-portal`                        | Railway                 | Deployed, healthcheck already configured                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `driver-portal`                       | Railway                 | **Correction: this WAS already deployed** (the "Not deployed" claim below was stale) — but had zero environment variables, no domain, and no healthcheck until this pass fixed all three. Its Dockerfile was also missing two required build `ARG`s (fixed).                                                                                                                                                                                                                                            |
| `operations-console`                  | Railway                 | **Correction (2026-09-14): both claims here were false.** `apps/operations-console/Dockerfile` exists on `main`, and the Railway service `@dripplex/operations-console` deployed SUCCESS (`ce32cdd2`) on 2026-09-13 22:23:43 from PR #384. Its later deployments read SKIPPED only because its watch patterns did not match those diffs. See the note under "Deploying `operations-console`" below — that recipe is superseded.                                                                         |
| `merchant-portal`, `rider-portal`     | Railway                 | **Correction (2026-09-14): "still not deployed" was false.** Both deployed SUCCESS from PR #384 on 2026-09-13 — `merchant-portal` `5e309b99` (22:22:32), `rider-portal` `f020290f` (22:22:45). `merchant.dripplex.com` and `rider.dripplex.com` both answer HTTP 200 today. Note that DPX-DRIVER-REDIRECT-001 §2 records these two as **retired** by the 2026-08-30 founder decision yet still serving their old portals — a contradiction that still needs its own decision, and is not resolved here. |
| `customer-mobile`                     | Railway (misconfigured) | **Correction:** a live Railway service _does_ exist for this name, but it incorrectly builds from `apps/customer-web/Dockerfile` — effectively a stray duplicate of customer-web. Flagged, not deleted, in the readiness doc §3.                                                                                                                                                                                                                                                                        |

### Deploying `driver-portal` to Railway (next step)

Same pattern as `customer-web`/`admin-portal`: new Railway service → this repo
→ Dockerfile builder → `apps/driver-portal/Dockerfile` → root build context.
Set `NEXT_PUBLIC_API_BASE_URL`/`NEXT_PUBLIC_APP_URL` build args and
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`NEXT_PUBLIC_CUSTOMER_APP_URL` env vars per
`apps/driver-portal/.env.example` (see `docs/ops/PRODUCTION-COOLIFY.md` §3 for
the exact variable table — same values apply regardless of platform). Set
`PORT=3005` explicitly (the Railway healthcheck-prober gotcha below applies
here too). Attach a public domain once deployed so it's reachable.

### Deploying `operations-console` to Railway (SUPERSEDED — do not follow)

> **Superseded 2026-08-24, annotated 2026-09-14.** Following this recipe would
> stand up a console the founder has explicitly decided against: `ops.dripplex.com`
> serves the Super App's console (`apps/super-app/src/app/App.tsx:518`). The
> standalone service still exists and still builds, but pointing a production
> domain at it is not the intended end state. The recipe is kept for history, not
> as an instruction.

#### Original recipe (historical)

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
- ~~`merchant-portal`, `rider-portal` have never been deployed anywhere~~ — **corrected 2026-09-14:** both have deployed to Railway (see the table above) and both hostnames answer 200. The documentation gap (no written deploy recipe) stands; the deployment gap does not.
- ~~`operations-console` has never been deployed anywhere either~~ — **corrected 2026-09-14:** the service exists and has deployed successfully (`ce32cdd2`, 2026-09-13). More importantly the remaining step described here — "creating the Railway service and pointing a domain at it" — is **no longer the plan**. The founder decided on 2026-08-24 that `ops.dripplex.com` serves the Super App's own console instead; the decision is recorded in code at `apps/super-app/src/app/App.tsx:518` ("the standalone operations-console is not the console we want; the super-app's is"). `ops.dripplex.com` and `app.dripplex.com` resolve to the same Railway service (`super-app`) and serve an identical bundle — measured, not inferred.
- No custom domain confirmed attached (verified access was via Railway-generated domains) — production domains (`www.dripplex.com`, `api.dripplex.com`, etc.) referenced in the archived docs were never actually pointed at this infrastructure.
- No monitoring/alerting/log aggregation has been set up for the Railway services specifically — the archived Prometheus/Grafana/Loki design assumed self-hosted infrastructure and doesn't transfer directly. Railway has built-in logs/metrics; whether that's sufficient or something more is wanted is an open question, not yet decided.
- Backup/restore strategy for Railway's managed Postgres has not been documented or tested (`docs/ops/BACKUPS.md` has generic `pg_dump` guidance that still applies conceptually, but nothing Railway-specific has been verified).

## Before treating this as launch-ready

Re-verify the "Verified" table above is still true (Railway state can drift independently of this repo), get R1.1–R1.3 actually migrated and deployed here, and work through the gaps above. See `docs/AUDIT-PRODUCTION-READINESS.md` for the full picture and `docs/REALITY-STAGE-R1.3.md` for what's shipped so far.
