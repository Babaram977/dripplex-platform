# Program D2 — Deployment Report

**Generated:** 2026-07-22T15:02:25Z  
**Branch:** `cursor/program-d2-complete-live-deployment-1b33`  
**Verdict: NOT LIVE — blocked on Cloudflare API authentication in this agent**

---

## Executive summary

In-repo packaging for all five production Workers is complete (correct names, custom domains, Workers Builds settings, CI workflow).  
**This cloud agent cannot authenticate Wrangler**: there is no `CLOUDFLARE_API_TOKEN` in the environment, and Cloudflare MCP interactive login only works in Cursor Desktop.

Registry nameservers for `dripplex.com` are Cloudflare (`jake.ns` / `molly.ns`), but authoritative queries to those NS currently return **REFUSED** (zone not Active / not yet serving), and public recursive DNS still often resolves apex/`www` to the old QServers host (Apache parking page).

---

## Worker names (configured)

| App                | Worker                  | workers.dev URL (after deploy)                        | Custom domains                                         |
| ------------------ | ----------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| customer-web       | `dripplex-customer-web` | `https://dripplex-customer-web.<account>.workers.dev` | `dripplex.com`, `www.dripplex.com`, `app.dripplex.com` |
| merchant-portal    | `dripplex-merchant`     | `https://dripplex-merchant.<account>.workers.dev`     | `merchant.dripplex.com`                                |
| rider-portal       | `dripplex-rider`        | `https://dripplex-rider.<account>.workers.dev`        | `rider.dripplex.com`                                   |
| admin-portal       | `dripplex-admin`        | `https://dripplex-admin.<account>.workers.dev`        | `admin.dripplex.com`                                   |
| operations-console | `dripplex-ops`          | `https://dripplex-ops.<account>.workers.dev`          | `ops.dripplex.com`                                     |

Obsolete: **`dripplex-platform`** → replaced by `dripplex-customer-web` (delete after first successful deploy).

`api.dripplex.com` is **not** a Worker (NestJS). Deploy via Docker/Compose; proxy via Cloudflare DNS when ready.

---

## Build status

| Check                                                           | Status                                      |
| --------------------------------------------------------------- | ------------------------------------------- |
| OpenNext + `wrangler deploy --dry-run` (customer-web, new name) | ✅ ~1.43 MiB gzip                           |
| Prior dry-runs (merchant/rider/admin/ops)                       | ✅ ~1.26 MiB gzip                           |
| Authenticated `wrangler deploy`                                 | ❌ No API token                             |
| Workers Builds trigger from agent                               | ❌ No API token / MCP needsAuth             |
| GitHub workflow `Deploy Cloudflare Workers`                     | Added — needs `CLOUDFLARE_API_TOKEN` secret |

### Workers Builds settings (customer-web)

| Setting        | Value                      |
| -------------- | -------------------------- |
| Root directory | `apps/customer-web`        |
| Build command  | `bash scripts/cf-build.sh` |
| Deploy command | `npx wrangler deploy`      |

---

## Live probes (this agent)

| URL                                      | HTTP | Notes                                                     |
| ---------------------------------------- | ---- | --------------------------------------------------------- |
| `https://dripplex.com`                   | 200  | Still Apache / QServers parking — **not** Dripplex Worker |
| `https://www.dripplex.com`               | 200  | Same                                                      |
| `https://app.dripplex.com`               | 000  | No DNS / not attached                                     |
| `https://merchant.dripplex.com`          | 000  | No DNS / not attached                                     |
| `https://rider.dripplex.com`             | 000  | No DNS / not attached                                     |
| `https://admin.dripplex.com`             | 000  | No DNS / not attached                                     |
| `https://ops.dripplex.com`               | 000  | No DNS / not attached                                     |
| `https://api.dripplex.com/api/v1/health` | 000  | Backend not deployed                                      |

TLS on apex/www: `CN=*.dripplex.com` (legacy host cert) — **not** Cloudflare Worker Universal SSL yet.

---

## DNS status

| Check                        | Result                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| Registry NS (RDAP)           | `JAKE.NS.CLOUDFLARE.COM`, `MOLLY.NS.CLOUDFLARE.COM`             |
| Authoritative query to CF NS | **REFUSED** — zone not serving                                  |
| Recursive A for www (often)  | Still `181.215.243.96` (QServers) until zone Active + cache TTL |

---

## Production env vars

Documented in `infrastructure/secrets/.env.production.example`.  
Portal Workers need build-time:

- `NEXT_PUBLIC_API_BASE_URL=https://api.dripplex.com/api/v1`
- `NEXT_PUBLIC_APP_URL` (per portal)
- optional `NEXT_PUBLIC_SENTRY_DSN`

Backend secrets (`DATABASE_URL`, `REDIS_URL`, JWT, SMTP, Termii, Paystack, etc.) stay on the API host — not on frontend Workers.

---

## Remaining blockers (external)

1. **Provide `CLOUDFLARE_API_TOKEN`** to this cloud agent environment **or** GitHub Actions secret `CLOUDFLARE_API_TOKEN` (+ optional `CLOUDFLARE_ACCOUNT_ID`), then re-run:
   - `bash scripts/cloudflare/d2-deploy-production.sh`, or
   - Actions → **Deploy Cloudflare Workers** → `confirm=deploy-production`
2. **Activate Cloudflare zone** so `jake`/`molly` answer authoritatively (dashboard zone status = Active).
3. **Authenticate Cloudflare MCP** in Cursor Desktop (optional; enables Builds/Bindings tools).
4. **Backend** host + secrets for `api.dripplex.com` (separate from Workers).

---

## Exact unblock steps

1. Cloudflare Dashboard → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** (add **Zone DNS Edit** for custom domains).
2. In Cursor Cloud environment or GitHub repo secrets, set `CLOUDFLARE_API_TOKEN=<token>`.
3. Confirm zone **dripplex.com** is Active.
4. Re-run this agent or: `bash scripts/cloudflare/d2-deploy-production.sh`.
5. Verify each custom domain returns HTTP 200 with Dripplex HTML (not Apache parking).
6. Delete obsolete Worker `dripplex-platform` if it still exists.
