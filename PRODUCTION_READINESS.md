# PRODUCTION_READINESS.md — Program D1 Live Launch

**Date:** 2026-07-22  
**Release:** Backend Core / portals `1.0.0`  
**Branch:** `cursor/program-d1-production-deployment-1b33`  
**Verdict: NO-GO — external blockers prevent live cutover**

This report records an **attempted** production deployment, not a configuration-only dry run.
All code/config fixes that could be made in-repo have been applied. Remaining failures require
Cloudflare account authentication, DNS ownership, and production host secrets.

---

## Deployment status

| Surface            | Target                                    | Attempted                                                                             | Result                                                 |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Customer Web       | Cloudflare Worker `dripplex-customer-web` | `wrangler deploy --dry-run` ✅ (~1.43 MiB gzip) / `--temporary` ❌ / authenticated ❌ | No `CLOUDFLARE_API_TOKEN`; preview account 1 MiB limit |
| Merchant Portal    | Worker `dripplex-merchant-portal`         | OpenNext build ✅ / dry-run ✅ (~1.26 MiB gzip) / authenticated ❌                    | Not live                                               |
| Rider Portal       | Worker `dripplex-rider-portal`            | OpenNext build ✅ / dry-run ✅ / authenticated ❌                                     | Not live                                               |
| Admin Portal       | Worker `dripplex-admin-portal`            | OpenNext build ✅ / dry-run ✅ / authenticated ❌                                     | Not live                                               |
| Operations Console | Worker `dripplex-operations-console`      | OpenNext build ✅ / dry-run ✅ / authenticated ❌                                     | Not live                                               |
| Backend Core       | `api.dripplex.com` (Docker/SSH)           | `DEPLOY_MODE=dry-run` scripts OK; no host/Docker/secrets                              | Not live — NestJS is not a Worker                      |

---

## Live URLs (verified from this agent)

| URL                                         | Expected           | Observed (2026-07-22)                                       |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| `https://www.dripplex.com`                  | Customer app       | HTTP 200 — **QServers parking page** (Apache), not DrippleX |
| `https://app.dripplex.com`                  | Customer app       | No usable DrippleX app response                             |
| `https://api.dripplex.com`                  | Backend `/api/v1`  | Unreachable / no API                                        |
| `https://merchant.dripplex.com`             | Merchant portal    | Unreachable                                                 |
| `https://rider.dripplex.com`                | Rider portal       | Unreachable                                                 |
| `https://admin.dripplex.com`                | Admin portal       | Unreachable                                                 |
| `https://ops.dripplex.com`                  | Operations console | Unreachable                                                 |
| `https://dripplex-customer-web.workers.dev` | CF preview         | Not serving                                                 |

---

## Worker names (configured)

| App                | `wrangler.jsonc` name         |
| ------------------ | ----------------------------- |
| customer-web       | `dripplex-customer-web`       |
| merchant-portal    | `dripplex-merchant-portal`    |
| rider-portal       | `dripplex-rider-portal`       |
| admin-portal       | `dripplex-admin-portal`       |
| operations-console | `dripplex-operations-console` |

---

## DNS status

| Check                     | Status                                         |
| ------------------------- | ---------------------------------------------- |
| Apex A `dripplex.com`     | `181.215.243.96` (QServers)                    |
| Nameservers               | `ns35/ns36.qservers*.net` — **not Cloudflare** |
| Cloudflare zone control   | **Blocked** — NS not at Cloudflare             |
| `api` / portal subdomains | Not pointing at Workers or production LB       |

Repo plan: `infrastructure/cloudflare/dns.csv` (includes `app` + `ops`).

---

## Backend status

| Item                      | Status                                                        |
| ------------------------- | ------------------------------------------------------------- |
| NestJS image / Dockerfile | Ready in-repo                                                 |
| Compose production file   | Ready (`infrastructure/docker/docker-compose.production.yml`) |
| Deploy script             | Ready (`scripts/cicd/deploy.sh`) — needs `DEPLOY_HOST` + SSH  |
| Running in production     | **No**                                                        |
| Workers-compatible        | **No** — see `apps/backend/docs/CLOUDFLARE-DEPLOYMENT.md`     |

---

## Frontend status

| Item                                | Status                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| OpenNext + Wrangler (customer)      | Ready; dry-run upload OK                                    |
| OpenNext + Wrangler (other portals) | Packaged this launch                                        |
| Authenticated CF deploy             | **Blocked** — no `CLOUDFLARE_API_TOKEN` / `wrangler login`  |
| Cloudflare MCP (Builds/Bindings)    | `needsAuth` — desktop-only interactive auth                 |
| Temporary preview deploy            | Failed — Worker **> 1 MiB** on preview account (code 10027) |

---

## Database / Redis status

| Item                | Status                                                    |
| ------------------- | --------------------------------------------------------- |
| Production Postgres | **Not provisioned / not reachable** from this environment |
| Production Redis    | **Not provisioned / not reachable**                       |
| Local `.env` DB     | Points at `localhost` only — not production               |

---

## Remaining blockers (external)

1. **Cloudflare authentication**
   - Set `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit + Account Read) **or** run `wrangler login` in an interactive session.
   - Authenticate Cloudflare MCP servers in **Cursor Desktop** (not available in cloud agents).

2. **DNS ownership**
   - Change `dripplex.com` nameservers from QServers → Cloudflare.
   - Create DNS / Worker custom domains for `www`, `app`, `api`, `merchant`, `rider`, `admin`, `ops`.

3. **Production secrets & hosts**
   - Load values from `infrastructure/secrets/.env.production.example` into a secret manager.
   - Provision Postgres + Redis; set `DATABASE_URL`, `REDIS_URL`, JWT, SMTP, Termii, Paystack, Maps, Sentry.
   - For Backend: set GitHub `PROD_DEPLOY_HOST`, `PROD_DEPLOY_USER`, `PROD_SSH_KEY` (or run Compose on a host with Docker).

4. **Backend runtime**
   - Deploy NestJS via Docker/Compose/K8s (not Workers). API must be live before portal auth flows work.

---

## Manual steps to go LIVE

1. Create Cloudflare API token → export `CLOUDFLARE_API_TOKEN` in CI / agent environment.
2. `bash scripts/cloudflare/deploy-all.sh` (or configure Workers Builds per `docs/ops/CLOUDFLARE-WORKERS-APPS.md`).
3. Move DNS NS to Cloudflare; attach custom domains to each Worker; deploy API origin.
4. `wrangler secret` / host env for production secrets; set `CORS_ORIGINS`.
5. Smoke: landing, register, login, OTP, refresh, dashboard, API health.
6. Re-run this checklist and flip verdict to **GO** only when URLs serve DrippleX.

---

## Live verification checklist (Phase 6–7)

| Check                                         | Pass? |
| --------------------------------------------- | ----- |
| Landing page                                  | ❌    |
| Registration                                  | ❌    |
| Login                                         | ❌    |
| OTP                                           | ❌    |
| Password reset                                | ❌    |
| JWT refresh                                   | ❌    |
| Dashboard                                     | ❌    |
| Navigation                                    | ❌    |
| API communication                             | ❌    |
| Static assets                                 | ❌    |
| PWA                                           | ❌    |
| Mobile responsive                             | ❌    |
| Backend register/login/logout/refresh/profile | ❌    |

---

## Go / No-Go recommendation

### **NO-GO**

The platform is **not** publicly accessible as DrippleX production. Configuration and deploy packaging are in place; cutover is blocked solely by account/DNS/host credentials outside this repository.

**Do not announce launch** until:

- Workers deploy successfully under a real Cloudflare account, **and**
- Custom domains resolve to those Workers (or Compose origin behind Cloudflare), **and**
- `https://api.dripplex.com/api/v1/health` returns healthy with production DB/Redis.
  EOF
