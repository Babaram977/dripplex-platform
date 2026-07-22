# Program D2 — Backend API Deployment Report

**Date:** 2026-07-22  
**Branch:** `cursor/program-d2-backend-api-deploy-1b33`  
**Scope:** NestJS Backend Core production infrastructure (no application logic changes)

---

## Verdict (pre-host)

| Item                                           | Status                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| API-only Docker Compose stack                  | ✅ Added (`infrastructure/docker/docker-compose.api.yml`) |
| Nginx + Let's Encrypt bootstrap                | ✅ Added                                                  |
| Host bootstrap / deploy / backup / DNS scripts | ✅ Added                                                  |
| GitHub Actions `Deploy Backend API`            | ✅ Added (push-trigger + secrets)                         |
| Frontend API base URL                          | ✅ Already `https://api.dripplex.com/api/v1` on Workers   |
| Live `https://api.dripplex.com`                | ⏳ Pending `PROD_DEPLOY_*` host secrets                   |
| Smoke tests against live API                   | ⏳ Pending host                                           |

---

## What was packaged

### Compose services

- `postgres` (16) + `pgbouncer` + `redis` (auth)
- `backend` + `worker` (same image)
- `nginx` (edge) + `certbot` (renew loop)
- `uptime-kuma` (basic monitoring)
- Restart policies + json-file log rotation
- Daily cron: cert renew + `pg_dump` backups (`scripts/backend/backup-postgres.sh`)

### CI deploy path

`.github/workflows/deploy-backend-api.yml`:

1. Build & push `ghcr.io/.../dripplex-backend-core:<sha>`
2. Rsync repo to `/opt/dripplex`
3. Write `.env.production` from GitHub secrets
4. Bootstrap Docker on host
5. Run `scripts/backend/deploy-api.sh` (migrate + TLS)
6. Set Cloudflare A record `api.dripplex.com` → host IP
7. HTTPS health + `scripts/cicd/smoke-test.sh`

### Smoke coverage (HTTP-level)

Health, auth sessions/login, OTP request/verify, password forgot, refresh/logout, customer wallet/orders/cart, merchant/rider/admin protected routes, payments initialize/webhook shape, CMS banners, portal shells when URLs set.

---

## External blocker

This cloud agent has:

- No Docker runtime
- No SSH private key
- No `PROD_DEPLOY_HOST` in the agent environment

**GitHub repository secrets required to go live:**

```
PROD_DEPLOY_HOST=<VPS public IP>
PROD_DEPLOY_USER=<ubuntu|deploy>
PROD_SSH_KEY=<ed25519 private key>
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
REDIS_PASSWORD
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET   # ≥32 chars each
CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID   # already used for Workers
```

Optional: `PAYSTACK_*`, `SMTP_*`, `TERMII_*`, `SENTRY_DSN`, `LETSENCRYPT_EMAIL`

### After secrets are set

1. Provision Ubuntu 24.04 VPS (Hetzner CX32+ recommended — see `docs/infrastructure/SERVER-SPEC.md`)
2. Add the public key matching `PROD_SSH_KEY` to the host
3. Touch trigger on `main`:

```bash
date -u -Iseconds > .github/trigger-backend-api-deploy
git add .github/trigger-backend-api-deploy
git commit -m "chore(ops): trigger backend API production deploy"
git push origin main
```

4. Confirm:
   - `curl -fsS https://api.dripplex.com/api/v1/health`
   - Actions → **Deploy Backend API** green
5. Update this report’s Verdict table to **LIVE**

---

## Frontend note

Cloudflare Workers already call `https://api.dripplex.com/api/v1`. Once the API health endpoint returns 200, auth/OTP/wallet/orders flows can be exercised end-to-end without redeploying portals (unless you change public env vars).

---

## Go / No-Go

**NO-GO for live API traffic until `PROD_DEPLOY_HOST` (+ SSH + DB/JWT secrets) are present and the Deploy Backend API workflow succeeds.**

Infrastructure and automation in this PR are ready to execute the cutover as soon as the VPS credentials are available.
EOF
