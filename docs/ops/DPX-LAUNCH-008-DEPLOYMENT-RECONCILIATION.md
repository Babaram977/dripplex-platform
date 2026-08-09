# DPX-LAUNCH-008 — Deployment Reconciliation (authoritative)

**Deployment platform: Railway (connected).** DrippleX is deployed via **Railway**,
connected to the GitHub repository (founder-confirmed). Railway's build/deploy is
configured in the **Railway dashboard**, which is why there is no `railway.json`
/`railway.toml` committed in the repo — that is expected, not a gap.

> **Correction note:** an earlier revision of this doc concluded (from repo
> workflow files) that deployment ran on Cloudflare Workers + GHCR/VPS and marked
> the Railway docs "superseded." That was wrong — it over-read repo-side scripts
> for a **deployment-side** fact. Railway is the connected deployment platform;
> `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` and `PRODUCTION-RAILWAY.md` are
> valid again (banners removed).

> Anything only confirmable against the live environment (Railway service config,
> real DNS/certs, secret values, the deployed commit, bucket ACLs) is labelled
> **OPERATOR/DEPLOYMENT-SIDE** and is not verifiable from this repo.

## 1. What lives in the repo vs. what Railway runs

- **Runs the deployment:** **Railway** (dashboard-connected to the repo; build +
  start + preDeploy configured there). Authoritative — see DPX-LAUNCH-001.
- **Also present in the repo (relationship to the live Railway deploy is
  OPERATOR/DEPLOYMENT-SIDE — do not assume they are the live path):** Cloudflare
  Workers deploy workflows (`.github/workflows/deploy-cloudflare-workers.yml`), a
  VPS Docker-Compose + `scripts/backend/deploy-api.sh`, and a GHCR image publish
  (`publish-images.yml`). These may be legacy/alternate; treat **Railway** as the
  authority where they conflict.
- **Platform-agnostic app facts (true regardless of platform):** backend global
  prefix `api/v1`; health `GET /api/v1/health`; forward-only Prisma migrations;
  RBAC bootstrap via `prisma/seed-rbac.cjs`; safe-until-configured providers.

## 2. Database migrations + RBAC bootstrap (critical)

- Migrations: `prisma migrate deploy` (forward-only; 60+ ordered migrations).
- **RBAC bootstrap is mandatory:** `node prisma/seed-rbac.cjs` — idempotent
  upsert of permissions/roles/grants; it also runs `prisma migrate deploy` itself.
  Without it a fresh DB breaks registration/login ("Role … is not configured").
- **On Railway, set this as the service's `preDeployCommand`:**
  **`node prisma/seed-rbac.cjs`** (OPERATOR/DEPLOYMENT-SIDE — Railway dashboard).
  The script's own header documents this Railway preDeployCommand usage. (The
  repo's `scripts/backend/deploy-api.sh` also invokes it, guarded by
  `prisma-foundation.spec.ts`, for the VPS/compose path if that is ever used.)
- **Rollback of a bad migration** = restore from the pre-migrate backup (no
  down-migrations). See §5.

## 3. Environment configuration / secrets (OPERATOR/DEPLOYMENT-SIDE)

Set on the Railway service (env vars). Hard-required at boot: `DATABASE_URL`,
`REDIS_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32), `NODE_ENV=production`,
prod `CORS_ORIGINS`. Feature/provider vars (safe-empty = disabled): `TERMII_*`
(SMS OTP), `RESEND_*` (email OTP), `FIREBASE_*` (push), `GOOGLE_MAPS_SERVER_API_KEY`,
`GOOGLE_CLIENT_*`, `OBJECT_STORAGE_*`, `PAYSTACK_*`/`FLUTTERWAVE_*` (card — dormant),
`MERCHANT_MODULE_ENABLED` (default `false`). The exact validated key names are in
`apps/backend/src/config/env.validation.ts`; `scripts/backend/write-env-production.sh`
enumerates them for the compose path. Real secret values live in Railway, never in
the repo.

## 4. Storage (OPERATOR/DEPLOYMENT-SIDE)

Set `OBJECT_STORAGE_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY` (+ optional
`REGION`, `PUBLIC_BASE_URL`). **The KYC/identity bucket MUST be PRIVATE-ACL** —
sensitive objects are served only via short-lived signed GET (DPX-STORAGE-001).
Empty config keeps uploads safely disabled.

## 5. Rollback (Railway)

- **Service:** redeploy a previous successful Railway deployment from the Railway
  dashboard (per DPX-LAUNCH-001). **OPERATOR/DEPLOYMENT-SIDE** — a specific past
  deployment is dashboard-only, not automatable from tooling.
- **Database:** restore from the pre-migrate backup (`docs/ops/BACKUPS.md`);
  migrations are forward-only. Redis is a cache/KV — flush if needed.
- Backups + a **tested restore** are an OPERATOR-SIDE prerequisite before launch.

## 6. Deployed-commit verification (OPERATOR/DEPLOYMENT-SIDE)

Confirm the live Railway deployment corresponds to the intended `main` commit.
Not verifiable from the repo — check the Railway deployment's source commit.

## 7. Health verification

`GET /api/v1/health` → `ok`/`degraded` (200) or `error` (503 only if DB+Redis both
down). Suitable for Railway's healthcheck and the DPX-LAUNCH-007 smoke test.
No separate `/ready` vs `/live` split (single-instance model).

## 8. DNS / TLS (OPERATOR/DEPLOYMENT-SIDE)

Custom domains + TLS are configured on the platform (Railway domains / the DNS
provider). Decide the apex↔`www` canonical behavior. Frontend/portal domains and
`driver.dripplex.com` are attached when their apps are deployed.

---

See also: **DPX-LAUNCH-001-RAILWAY-READINESS.md** (Railway readiness detail),
**DPX-LAUNCH-007** (cash-launch smoke test), **docs/ops/BACKUPS.md** (backup/restore).
