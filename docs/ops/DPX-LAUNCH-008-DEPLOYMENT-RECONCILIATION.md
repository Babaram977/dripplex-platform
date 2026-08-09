# DPX-LAUNCH-008 — Deployment Architecture Reconciliation (authoritative)

**Why this exists:** earlier readiness/rollback docs describe a **Railway** (and
Coolify) deployment. The **actual** deployment path on `main` is **Cloudflare
Workers (frontends) + GHCR image → self-hosted VPS via Docker Compose + nginx +
certbot (backend)**. This document is the **current source of truth** for the
deployment/rollback sequence and supersedes the Railway/Coolify architecture in
the docs listed under "Superseded" below. It changes **no** infrastructure.

> Anything that can only be confirmed against the live environment (real DNS,
> issued certs, secret values, the deployed image digest, cloud bucket ACLs) is
> labelled **OPERATOR/DEPLOYMENT-SIDE** and is not verifiable from this repo.

## 1. Actual architecture (verified from repo)

- **Backend:** multi-stage Docker image → **GHCR** (`ghcr.io/babaram977/dripplex-backend-core`), deployed to a VPS with `infrastructure/docker/docker-compose.api.yml` (backend + worker + postgres:16 + pgbouncer + redis + nginx + certbot + uptime-kuma). Pipeline: `.github/workflows/deploy-backend-api.yml` → `scripts/backend/deploy-api.sh`. Backend serves under `api.dripplex.com`, global prefix `api/v1`, health `GET /api/v1/health` (also the container `HEALTHCHECK`).
- **Frontends:** Next.js via **OpenNext → Cloudflare Workers** (`wrangler`), pipeline `.github/workflows/deploy-cloudflare-workers.yml`. Workers: `dripplex-customer-web` (apex/`www`/`app`), `dripplex-merchant`, `dripplex-rider`, `dripplex-admin`, `dripplex-ops`. **`driver-portal` has no deploy binding** (no wrangler/matrix entry) — Driver-launch dependency.
- **Not used:** Railway, Coolify, Vercel, Fly, Render (no active config for these).

## 2. Reconciled deployment sequence (backend)

1. CI green on `main` → publish image to GHCR (`publish-images.yml`).
2. Trigger deploy: `deploy-backend-api.yml` (manual `workflow_dispatch` confirm phrase, or a push touching `.github/trigger-backend-api-deploy`) → runs `scripts/backend/deploy-api.sh` on the host.
3. `deploy-api.sh`: brings up the compose stack, then runs **`node prisma/seed-rbac.cjs`** which **applies migrations (`prisma migrate deploy`) AND seeds the RBAC catalog** (idempotent). _(Corrected by PR #77 — previously ran migrate-only, which left RBAC unseeded; see §4.)_
4. certbot issues/renews TLS for `api.dripplex.com`; nginx switches to the LE cert.
5. Health gate: the pipeline polls `https://api.dripplex.com/api/v1/health` and smoke-checks before completing.

## 3. Reconciled sequence (frontends)

`deploy-cloudflare-workers.yml` (same manual/trigger-file gating) runs `wrangler deploy` per app and attaches custom domains. **OPERATOR-SIDE:** Cloudflare API token/zone, DNS records, and TLS are managed in Cloudflare.

## 4. Database migrations + RBAC bootstrap

- Migrations: `prisma migrate deploy` (forward-only; 60+ ordered migrations in `apps/backend/prisma/migrations/`).
- **RBAC bootstrap is mandatory and now automated in the deploy path**: `node prisma/seed-rbac.cjs` (idempotent upsert of permissions/roles/grants) — a fresh DB without it breaks registration/login ("Role … is not configured"). A static test (`prisma-foundation.spec.ts`) guards that `deploy-api.sh` invokes it.
- **Rollback of a bad migration** = restore from the pre-migrate backup (no down-migrations). See §7.

## 5. Environment configuration / secrets (OPERATOR-SIDE)

- Written by `scripts/backend/write-env-production.sh` (host env → `.env.production`). Hard-required: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32), `NODE_ENV=production`, prod `CORS_ORIGINS`.
- Feature/provider vars (safe-empty = disabled): `TERMII_*` (SMS OTP), `RESEND_*` (email OTP), `FIREBASE_*` (push), `GOOGLE_MAPS_SERVER_API_KEY`, `GOOGLE_CLIENT_*`, `OBJECT_STORAGE_*`, `PAYSTACK_*`/`FLUTTERWAVE_*` (card — dormant), `MERCHANT_MODULE_ENABLED` (default `false`).
- The writer now emits the exact keys the backend reads (corrected by PR #76). **OPERATOR-SIDE:** the real secret values live in GitHub Actions secrets / the host, never in the repo.

## 6. Storage (OPERATOR-SIDE)

Set `OBJECT_STORAGE_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY` (+ optional `REGION`, `PUBLIC_BASE_URL`). **The KYC/identity bucket MUST be PRIVATE-ACL** — sensitive objects are served only via short-lived signed GET (DPX-STORAGE-001). Empty config keeps uploads safely disabled.

## 7. Rollback

- **Backend:** re-deploy a previous known-good GHCR image tag (compose pulls the pinned tag). **OPERATOR-SIDE:** select the prior tag/commit; then re-run the health gate.
- **Frontends:** re-deploy the previous Worker version (Cloudflare dashboard / `wrangler rollback`). **OPERATOR-SIDE.**
- **Database:** restore from the pre-migrate backup (`docs/ops/BACKUPS.md`); migrations are forward-only. Redis is a cache/KV — flush if needed.
- Backups + a **tested restore** are an OPERATOR-SIDE prerequisite before launch.

## 8. Image / commit verification (OPERATOR-SIDE)

Confirm the live backend image digest corresponds to the intended `main` commit (the deploy tags `:<sha>`, `:<version>`, `:production`). Not verifiable from the repo — check GHCR + the host's running image.

## 9. Health verification

`GET /api/v1/health` returns `ok`/`degraded` (200) or `error` (503 only if DB+Redis both down). Used by the container healthcheck, compose, the deploy gate, and DPX-LAUNCH-007 step 1. There is no separate `/ready` vs `/live` split (single-instance model).

## 10. DNS / TLS responsibilities (OPERATOR-SIDE)

Cloudflare hosts DNS + TLS for the Worker domains; certbot handles `api.dripplex.com` on the VPS origin. Decide the apex↔`www` canonical redirect (both currently bind `dripplex-customer-web`). Add `driver.dripplex.com` only when the driver portal is deployed.

---

## Superseded (architecture only — content retained for history)

The following describe Railway/Coolify and are **superseded by this document for
deployment architecture**; treat their app-behavior notes as still useful but
their infra topology as historical:

- `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md`
- `docs/ops/PRODUCTION-RAILWAY.md`
- `docs/ops/PRODUCTION-COOLIFY.md`

Other docs mention Railway incidentally (audits, release history) and are left
as-is; this document is the authority where they conflict on deployment topology.
