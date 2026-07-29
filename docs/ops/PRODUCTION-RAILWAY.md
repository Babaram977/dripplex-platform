# Production infrastructure — Railway (canonical)

**Status of this document:** Railway was chosen as the single production infrastructure target on 2026-07-28, following `docs/AUDIT-PRODUCTION-READINESS.md`, replacing the Cloudflare Workers / Hetzner / GHCR design in `docs/archive/pre-railway-infrastructure/`. Everything below marked **Verified** was confirmed hands-on in an earlier working session (live `curl` against the deployed API, not assumption). Everything marked **Not yet verified this session** needs a fresh check — this session has not had Railway tool access, so nothing here has been re-confirmed as still true today, and none of Reality Stage R1.1–R1.3 has reached it yet.

## What's actually running (Verified, as of last confirmed check)

| Service | Platform | Status |
|---|---|---|
| Backend (`@dripplex/backend`, NestJS) | Railway | Verified live — `/api/v1/health` returned healthy, database + Redis both up |
| PostgreSQL | Railway (managed addon) | Verified — 14 migrations applied via `preDeployCommand` at the time |
| Redis | Railway (managed addon) | Verified — backend connected successfully |
| `customer-web` | Railway | Verified deployed and reachable |
| `admin-portal` | Railway | Verified deployed and reachable |
| `merchant-portal`, `rider-portal`, `operations-console` | — | Not deployed anywhere. No blocker to deploying them the same way as `customer-web`/`admin-portal` once needed. |
| `driver-portal` | — | Not deployed; overlaps with `rider-portal` — confirm with founder whether it's still needed before spending deploy effort on it. |
| `customer-mobile` | — | Not applicable to Railway — it's a Capacitor shell that loads `customer-web`, not an independently deployable service. Store submission is separately gated (see `docs/AUDIT-PRODUCTION-READINESS.md` §5). |

## Configuration that works (Verified)

- **Builder:** Dockerfile per app (`apps/backend/Dockerfile`, `apps/customer-web/Dockerfile`, `apps/admin-portal/Dockerfile`) — Railway's Railpack auto-builder does not work for this pnpm-workspace monorepo and must be explicitly overridden to Dockerfile mode per service.
- **`DATABASE_URL`:** must be composed from Postgres's individual component variables, not the platform's pre-built `${{Postgres.DATABASE_URL}}` reference (that one resolved to `localhost` incorrectly at the time this was debugged):
  ```
  postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
  ```
- **`PORT`:** must be set explicitly (`PORT=3000`) as its own variable. Railway's healthcheck prober reads `PORT` specifically, separate from the domain's "Target Port" networking setting — the app can be listening correctly and still fail healthchecks if only `API_PORT` (the app's own config var) is set without also setting `PORT`.
- **Migrations on deploy:** backend's `preDeployCommand` runs `node_modules/.bin/prisma migrate deploy` before each deploy. This requires `prisma` to be in `dependencies`, not `devDependencies` — `pnpm prune --prod` (used in the Docker runtime stage) drops `devDependencies`, which would otherwise silently remove the Prisma CLI and make every future deploy's migration step a no-op. (This was the root cause of a production crash loop before it was caught — the app boots fine without a migrated schema, but the first request that touches a missing table crashes the process.)
- **Workspace package builds:** `@dripplex/types`, `@dripplex/utils`, `@dripplex/sdk` are dist-based workspace packages — each app's Dockerfile must explicitly run `pnpm --filter <pkg> build` for all three before building the app itself, or the build fails with `Cannot find module '@dripplex/types'`.
- **Variables set via Raw Editor:** the Raw Editor replaces the *entire* variable set for a service, not just the edited key. Always paste the complete variable block, never a partial edit, or you'll silently drop unrelated variables (this happened once — lost `REDIS_URL`/JWT secrets while only trying to fix `DATABASE_URL`).

## Known gaps (not yet done, as of this document)

- Nothing from Reality Stage R1.1 (Product Catalog schema), R1.2 (Merchant API), or R1.3 (Customer API) has been deployed here — those migrations and that code exist only on `claude/dripplex-coolify-deploy-fatig4`, unmerged, because Railway tool access has been unavailable for the entirety of that work.
- `merchant-portal`, `rider-portal`, `operations-console` have never been deployed anywhere.
- No custom domain confirmed attached (verified access was via Railway-generated domains) — production domains (`www.dripplex.com`, `api.dripplex.com`, etc.) referenced in the archived docs were never actually pointed at this infrastructure.
- No monitoring/alerting/log aggregation has been set up for the Railway services specifically — the archived Prometheus/Grafana/Loki design assumed self-hosted infrastructure and doesn't transfer directly. Railway has built-in logs/metrics; whether that's sufficient or something more is wanted is an open question, not yet decided.
- Backup/restore strategy for Railway's managed Postgres has not been documented or tested (`docs/ops/BACKUPS.md` has generic `pg_dump` guidance that still applies conceptually, but nothing Railway-specific has been verified).

## Before treating this as launch-ready

Re-verify the "Verified" table above is still true (Railway state can drift independently of this repo), get R1.1–R1.3 actually migrated and deployed here, and work through the gaps above. See `docs/AUDIT-PRODUCTION-READINESS.md` for the full picture and `docs/REALITY-STAGE-R1.3.md` for what's shipped so far.
