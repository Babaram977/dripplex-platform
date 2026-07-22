# Deployment runbook (RC1)

## Preconditions

1. Tag or freeze commit at `v1.0.0-rc.1` / branch `cursor/program-c4-release-candidate-1b33` (after merge chain C1→C4).
2. Secrets loaded from secret manager (never `.env` in images).
3. Staging Postgres + Redis healthy.
4. Quality gates green on the freeze commit (see `docs/PROGRAM-C4.md`).

## Order of operations

```text
1. Database migrations (Prisma deploy)
2. Backend deploy + health check
3. Frontend portals (customer → merchant → rider → admin → ops)
4. Smoke checklist (docs/ops/SMOKE-CHECKLIST.md)
```

## 1. Database migration order

From `apps/backend`:

```bash
pnpm prisma:migrate:deploy
```

Migrations are ordered by timestamp under `apps/backend/prisma/migrations/`. Apply **only** with `migrate deploy` in staging/production (never `migrate dev`).

RC1 schema is frozen — no new migrations in this phase. If a migration fails mid-way:

1. Stop frontend and API rollouts.
2. Follow `docs/ops/ROLLBACK.md`.
3. Restore DB from pre-migrate backup (`docs/ops/BACKUPS.md`).

## 2. Backend deployment

### Docker (recommended)

```bash
docker compose -f infrastructure/docker/docker-compose.staging.yml up -d postgres redis
# after migrate:
docker build -f apps/backend/Dockerfile -t dripplex-backend:1.0.0-rc.1 .
docker compose -f infrastructure/docker/docker-compose.staging.yml up -d backend
curl -fsS https://api.<staging>/api/v1/health
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
export NEXT_PUBLIC_API_BASE_URL=https://api.<staging>/api/v1
pnpm --filter @dripplex/customer-web build
pnpm --filter @dripplex/merchant-portal build
pnpm --filter @dripplex/rider-portal build
pnpm --filter @dripplex/admin-portal build
pnpm --filter @dripplex/operations-console build
```

Customer-web Dockerfile: `apps/customer-web/Dockerfile` (standalone Next). Other portals follow the same pattern or platform host (Vercel/Cloud Run) with identical env.

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
| Version          | Confirm deploy tag `1.0.0-rc.1`             |

## Release checklist (summary)

- [ ] Pre-migrate DB backup taken
- [ ] Secrets present and validated (`validateEnv`)
- [ ] Migrations deployed
- [ ] Backend healthy
- [ ] All portals built with HTTPS API URL
- [ ] Smoke checklist signed
- [ ] Monitoring alerts wired (or accepted deferred)
- [ ] Rollback owner named
- [ ] Staging approval recorded — **wait before production**
