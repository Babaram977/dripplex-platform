# Backend Core — production API deployment (Program D2)

Frontends already run on Cloudflare Workers. This guide deploys **NestJS Backend Core** only.

## Stack

| Component                                  | Role                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `docker-compose.api.yml`                   | Postgres 16, PgBouncer, Redis 7, API, worker, Nginx, Certbot, Uptime Kuma |
| `scripts/backend/deploy-api.sh`            | Host-side bring-up, migrate, TLS, cron                                    |
| `scripts/backend/dns-api.sh`               | Cloudflare A record for `api.dripplex.com`                                |
| `.github/workflows/deploy-backend-api.yml` | Build image → SSH deploy → DNS → smoke                                    |

## Required GitHub secrets

| Secret                                                | Purpose                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| `PROD_DEPLOY_HOST`                                    | VPS IP or hostname                                                    |
| `PROD_DEPLOY_USER`                                    | SSH user (sudo for bootstrap)                                         |
| `PROD_SSH_KEY`                                        | Private key (ed25519)                                                 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database                                                              |
| `REDIS_PASSWORD`                                      | Redis                                                                 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`            | Auth (≥32 chars)                                                      |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID`         | DNS for `api`                                                         |
| Optional                                              | `PAYSTACK_*`, `SMTP_*`, `TERMII_*`, `SENTRY_DSN`, `LETSENCRYPT_EMAIL` |

## Trigger

```bash
# After secrets are set — touch trigger on main (cloud agents cannot workflow_dispatch)
date -u > .github/trigger-backend-api-deploy
git commit -am "chore(ops): trigger backend API deploy"
git push origin main
```

Or Actions → **Deploy Backend API** → `confirm=deploy-api-production`.

## Manual host path

```bash
# On Ubuntu 24.04 VPS
sudo bash scripts/backend/bootstrap-host.sh
# Sync repo to /opt/dripplex, write .env.production
export BACKEND_IMAGE=ghcr.io/babaram977/dripplex-backend-core:production
sudo bash scripts/backend/deploy-api.sh
# DNS
export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ZONE_ID=… API_ORIGIN_IP=<vps-ip>
bash scripts/backend/dns-api.sh
```

## Cloudflare SSL

Set zone SSL/TLS mode to **Full (strict)** once Let's Encrypt or Origin CA is on the host.  
Until LE succeeds, bootstrap self-signed certs are used — use **Full** (not Flexible).

## Frontend API URL

Workers already build with `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1` (`apps/*/scripts/cf-build.sh`). No frontend rebuild required when the API comes online.

## Verify

```bash
curl -fsS https://api.dripplex.com/api/v1/health
API_BASE_URL=https://api.dripplex.com/api/v1 SMOKE_STRICT=1 ./scripts/cicd/smoke-test.sh
```
