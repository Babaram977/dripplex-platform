# Deployment runbook — Production v1.0.0

## Preconditions

1. Tag or freeze commit at `v1.0.0` (Program D5 / Release Tag workflow).
2. Secrets loaded from secret manager (never `.env` in images).
3. Production Postgres + Redis healthy; pre-migrate backup taken.
4. Quality gates green on the freeze commit (see `docs/PROGRAM-D5.md`).
5. `docs/ops/PRE-LAUNCH-CHECKLIST.md` signed.

## Order of operations

```text
1. Database migrations (Prisma deploy)
2. Backend deploy + health check
3. Frontend portals (customer → merchant → rider → admin)
4. Warm caches (scripts/golive/warm-caches.sh)
5. Smoke + production validation
```

Prefer `docs/ops/GO-LIVE.md` and `scripts/golive/go-live.sh` for the full cutover.

## 1. Database migration order

From `apps/backend` (or migrate container):

```bash
pnpm prisma:migrate:deploy
```

Migrations are ordered by timestamp under `apps/backend/prisma/migrations/`. Apply **only** with `migrate deploy` in staging/production (never `migrate dev`).

Schema is frozen for D5 — no new migrations in this phase. If a migration fails mid-way:

1. Stop frontend and API rollouts.
2. Follow `docs/ops/ROLLBACK.md`.
3. Restore DB from pre-migrate backup (`docs/ops/BACKUPS.md`).

## 2. Backend deployment

### Docker (recommended)

```bash
# Via CI: Deploy Production workflow with image_tag=v1.0.0
# Or SSH compose on prod hosts — see scripts/cicd/deploy.sh
curl -fsS https://api.dripplex.com/api/v1/health
```

### Manual

```bash
pnpm --filter @dripplex/backend prisma:generate
pnpm --filter @dripplex/backend build
pnpm --filter @dripplex/backend start:prod
```

Health must report DB + Redis ok before portals go live.

## 3. Frontend deployment

Build each portal with production env:

```bash
export NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1
pnpm --filter @dripplex/customer-web build
pnpm --filter @dripplex/merchant-portal build
pnpm --filter @dripplex/rider-portal build
pnpm --filter @dripplex/admin-portal build
pnpm --filter @dripplex/operations-console build
```

Prefer GHCR images from D2 publish pipeline.

Ensure reverse proxy:

- HTTPS only
- Forwards `Host` / `X-Forwarded-Proto`
- Does not strip CSP/HSTS set by Next

## 4. Post-deploy verification

| Step             | Command / check                             |
| ---------------- | ------------------------------------------- |
| API health       | `GET /api/v1/health` → 200                  |
| CORS             | Portal origin can call API                  |
| Auth login       | Customer + one portal                       |
| Security headers | Response includes CSP + HSTS                |
| PWA (customer)   | `/manifest.webmanifest`, `/sw.js` reachable |
| Version          | Confirm deploy tag `1.0.0` / `v1.0.0`       |
| Validation       | `docs/ops/PRODUCTION-VALIDATION.md`         |

## Release checklist (summary)

- [ ] Pre-migrate DB backup taken
- [ ] Secrets present and validated (`validateEnv`)
- [ ] Migrations deployed
- [ ] Backend healthy
- [ ] All portals built with HTTPS API URL
- [ ] Smoke checklist signed
- [ ] Monitoring alerts wired
- [ ] Rollback owner named
- [ ] Pre-launch checklist signed — go-live executed
