# Program D2 — Deployment Report (LIVE)

**Generated:** 2026-07-22T16:07:00Z  
**Actions run (Workers):** https://github.com/Babaram977/dripplex-platform/actions/runs/29935179849  
**Actions run (domains):** https://github.com/Babaram977/dripplex-platform/actions/runs/29936515583

## Verdict

**Frontend Workers: LIVE** on Cloudflare (`workers.dev` + custom domains).  
**Backend API (`api.dripplex.com`): NOT deployed** — NestJS still needs Docker/Compose host + secrets.

---

## Workers

| Worker                  | workers.dev                                         | Custom domains                                         | HTTP |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------ | ---- |
| `dripplex-customer-web` | https://dripplex-customer-web.danwakili.workers.dev | `dripplex.com`, `www.dripplex.com`, `app.dripplex.com` | 200  |
| `dripplex-merchant`     | https://dripplex-merchant.danwakili.workers.dev     | `merchant.dripplex.com`                                | 200  |
| `dripplex-rider`        | https://dripplex-rider.danwakili.workers.dev        | `rider.dripplex.com`                                   | 200  |
| `dripplex-admin`        | https://dripplex-admin.danwakili.workers.dev        | `admin.dripplex.com`                                   | 200  |
| `dripplex-ops`          | https://dripplex-ops.danwakili.workers.dev          | `ops.dripplex.com`                                     | 200  |

Obsolete Worker `dripplex-platform` was removed (best-effort delete step).

---

## Custom domains (verified)

| URL                           | HTTP | Title / content                     |
| ----------------------------- | ---- | ----------------------------------- |
| https://dripplex.com          | 200  | Dripplex — life, Simplified         |
| https://www.dripplex.com      | 200  | Dripplex — life, Simplified         |
| https://app.dripplex.com      | 200  | Dripplex — life, Simplified         |
| https://merchant.dripplex.com | 200  | Dripplex Merchant Portal            |
| https://rider.dripplex.com    | 200  | Dripplex Rider Portal               |
| https://admin.dripplex.com    | 200  | Dripplex Admin Portal               |
| https://ops.dripplex.com      | 200  | Dripplex Operations Console         |
| https://api.dripplex.com      | —    | **Not live** (backend not deployed) |

SSL: Cloudflare edge certificates active (`cert_id` issued per hostname; HSTS present on Worker domains).

---

## Build / deploy status

| Step                                                             | Result                                          |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| GitHub secrets (`CLOUDFLARE_API_TOKEN`, `ACCOUNT_ID`, `ZONE_ID`) | ✅ Used by Actions                              |
| OpenNext build + `wrangler deploy` (all 5)                       | ✅                                              |
| Domain attach `app` / `merchant` / `rider` / `admin` / `ops`     | ✅                                              |
| Domain attach apex/`www` (first attempt)                         | ❌ error 100117 conflicting A/CNAME to QServers |
| Delete conflicting DNS + re-attach apex/`www`                    | ✅                                              |

---

## Remaining blockers

1. **Backend Core** — deploy NestJS to production (Docker/Compose/SSH) and point `api.dripplex.com` at it (or Cloudflare Containers). Until then, portal auth/API calls to `https://api.dripplex.com/api/v1` will fail.
2. Optional: MX/TXT at apex still reference QServers IP for mail — review if email should move.
3. Local recursive DNS may lag; Cloudflare DoH / anycast already serves Dripplex.

---

## How to redeploy

```bash
# Full rebuild + deploy (touches trigger file on main)
# or Actions → Deploy Cloudflare Workers

# Domains only
# Actions → Attach Cloudflare Domains
# or touch .github/trigger-cf-domains-attach on main
```
