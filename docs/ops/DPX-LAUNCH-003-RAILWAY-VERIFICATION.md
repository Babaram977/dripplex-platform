# DPX-LAUNCH-003 — Railway Production Verification (live re-check)

**Date:** 2026-08-06
**Trigger:** "verify railway" — a fresh live verification pass against the
Railway API, re-confirming production state after Launch Track 1
(`DPX-LAUNCH-001`), the 1.5 stabilization window (`DPX-LAUNCH-001.5`), and
the custom-domain configuration (`DPX-LAUNCH-002`).

This pass **verifies live state via the Railway API and deploy/HTTP logs**
— it is a read-only re-check, no configuration, variables, or secrets were
touched. Project: `overflowing-unity`
(`f09361bd-3cda-4f0f-a22a-2ea464e47ab2`), environment `production`
(`2a5bfc88-aeee-437e-9695-1c5176d424b8`).

## 1. Service inventory — all deployments SUCCESS

Verified via `get-status` (2026-08-06). Every service's latest deployment
is `SUCCESS`; nothing degraded, crashed, or building.

| Service                     | Latest deploy | Status       | Custom domain           |
| --------------------------- | ------------- | ------------ | ----------------------- |
| `@dripplex/backend`         | 2026-08-06 02:41 | ✅ SUCCESS | `api.dripplex.com`      |
| `@dripplex/customer-web`    | 2026-08-05 21:45 | ✅ SUCCESS | `www.dripplex.com`      |
| `@dripplex/admin-portal`    | 2026-08-05 21:45 | ✅ SUCCESS | `admin.dripplex.com`    |
| `@dripplex/driver-portal`   | 2026-08-05 20:55 | ✅ SUCCESS | `driver.dripplex.com`   |
| `@dripplex/merchant-portal` | 2026-08-05 21:45 | ✅ SUCCESS | `merchant.dripplex.com` |
| `@dripplex/operations-console` | 2026-08-05 21:45 | ✅ SUCCESS | `ops.dripplex.com`   |
| `Postgres`                  | 2026-07-27       | ✅ SUCCESS (1 replica) | private only  |
| `Redis`                     | 2026-07-27       | ✅ SUCCESS (1 replica) | private only  |
| `@dripplex/customer-mobile` | 2026-07-27       | ✅ SUCCESS | (stray — see §5)        |

**Advances past the DPX-LAUNCH-001 readiness snapshot:** that document
listed `merchant-portal` and `operations-console` as *"Not deployed"* and
`main` as *65 commits behind*. Both are now **deployed and SUCCESS**, and
`main` is caught up (§3). All six app services now carry custom domains
(§2), which DPX-LAUNCH-001 flagged as *"no custom domain confirmed
attached."*

## 2. Custom domains — attached with correct target ports

Verified per-service via `list-domains`. Ports match each service's actual
listening port (the class of bug caught on `driver-portal` in Launch Track
1 — re-checked here, not assumed):

| Service              | Custom domain           | targetPort |
| -------------------- | ----------------------- | ---------- |
| `backend`            | `api.dripplex.com`      | 3000       |
| `customer-web`       | `www.dripplex.com`      | 8080       |
| `admin-portal`       | `admin.dripplex.com`    | 8080       |
| `driver-portal`      | `driver.dripplex.com`   | 3005       |
| `merchant-portal`    | `merchant.dripplex.com` | 8080       |
| `operations-console` | `ops.dripplex.com`      | 8080       |

## 3. Deploy source & `main` alignment

- Backend `get-service-config`: builder `DOCKERFILE`
  (`apps/backend/Dockerfile`), start `node dist/main.js`, healthcheck
  `/api/v1/health` (30s, 3 retries), `preDeployCommand`
  `prisma migrate deploy`. Deploys from `main`. Build `watchPatterns`
  scoped to `apps/backend/**` + shared packages.
- Backend's current live deployment (`18c647d9`, SUCCESS) is from commit
  `617889d` on `main` — the DPX-LAUNCH-002 report commit.
- `main` and the verification branch both point at `617889d`; the 65-commit
  gap from Launch Track 1 is fully closed. Deploy history confirms Railway
  auto-deploys on push to `main` (recent redeploys all carry `main`
  commit hashes).

## 4. Backend runtime health

- **Boot:** deploy logs show a clean start — routes mapped
  (`HealthController {/api/v1/health}`), `listening on
  http://0.0.0.0:3000/api/v1`. No boot errors, no restart loop.
- **Migrations:** `prisma migrate deploy` runs as the pre-deploy step;
  Railway only marks the deploy SUCCESS after that step and its own
  health-check probe pass — both did.
- **Errors:** the only `error`-severity lines on the current deployment
  are NestJS 404s from an external scanner (`ZOLTRAAK/0.2.0`,
  `srcIp 31.77.203.199`) probing for an exposed LLM proxy at
  `/api/v1/health/models` and `/api/v1/health/chat/completions` — all
  correctly returned 404. No such routes exist; this is internet
  background noise, not an app fault and not a breach.
- **Metrics (6h window):** CPU avg ~0.08%, memory avg ~100 MB
  (min 87 MB / max 203 MB), stable — consistent with the
  DPX-LAUNCH-001.5 baseline and the "no real traffic yet" expectation.
- **Variables present** (names only — this session's Railway connection
  redacts values): `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`,
  `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`, `FIREBASE_PROJECT_ID/
  CLIENT_EMAIL/PRIVATE_KEY`. The 4 hard-required boot vars are all
  present. Still absent, exactly as DPX-LAUNCH-001 §B documented as
  founder-pending: payment keys (Paystack/Flutterwave/OPay),
  `GOOGLE_MAPS_SERVER_API_KEY`, Smile ID, Sentry DSNs.

## 5. Known items carried forward (unchanged, not regressions)

- **`customer-mobile` stray service** — still a Capacitor shell
  mistakenly deployed as a web service off `customer-web`'s Dockerfile.
  Live and SUCCESS, harmless, deliberately untouched (per Launch Track 1
  §A). Flagged again here only for continuity.
- **`rider-portal`** — still not deployed; not required for Ride launch.
- **Founder-pending credentials** (§B of DPX-LAUNCH-001) and the
  **backup-plan/restore-drill** decision (DPX-LAUNCH-001.5 §4/§8) remain
  open — both need Railway dashboard access or founder-supplied secrets
  this session structurally cannot provide.

## 6. Verification limitations (stated, not worked around)

- **Direct HTTP probing of the live domains was not possible from this
  session** — the sandbox egress proxy denies outbound CONNECT to these
  hosts (`403`, confirmed via the proxy status endpoint), the same
  tool-level restriction DPX-LAUNCH-002 §2 hit with WebFetch. Live health
  was therefore verified through Railway's own deploy status + logs
  (authoritative: Railway's health-check prober must get a 200 for a
  deploy to reach SUCCESS), not by an independent external request.
- **Variable values are redacted** for this session — only names are
  verifiable, not contents. `NEXT_PUBLIC_API_BASE_URL` on each frontend
  is confirmed *present* but its value can't be read here (same as
  DPX-LAUNCH-002 §3).

## 7. Verdict

Railway production is **healthy and consistent with documented state**:
all nine services deploying and SUCCESS, `main` fully deployed with the
65-commit gap closed, all six app services on custom domains with correct
ports, backend booting clean with migrations wired and healthchecks
passing, and resource use flat at baseline. No regressions. The only open
items are the previously-documented founder-pending credentials and the
backup/restore decision — nothing technical is newly broken or blocking.
