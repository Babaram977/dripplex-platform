# Program D — Phase D5: Production Launch & Go-Live

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Program**      | D — Production Launch                          |
| **Phase**        | D5 — Production Launch & Go-Live               |
| **Status**       | Complete — awaiting review                     |
| **Branch**       | `cursor/program-d5-production-launch-1b33`     |
| **Base**         | D4 (`cursor/program-d4-mobile-packaging-1b33`) |
| **Version**      | **1.0.0**                                      |
| **Last updated** | 2026-07-22                                     |

## Constraints honored

- No new features
- No UI redesign
- No Backend API / schema changes
- No infrastructure redesign
- Production launch packaging + executable go-live runbooks only

---

## 1. Pre-launch verification

| Check                                             | Status                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Production domain matrix documented               | ✅ `docs/ops/PRE-LAUNCH-CHECKLIST.md`                                                 |
| Cloudflare DNS / SSL checklist                    | ✅                                                                                    |
| GitHub Environment secrets checklist              | ✅                                                                                    |
| DB / Redis / Object storage checklist             | ✅                                                                                    |
| Firebase / APNS / SMTP / SMS / Payments checklist | ✅                                                                                    |
| Monitoring + status page checklist                | ✅                                                                                    |
| Automated preflight script                        | ✅ `scripts/golive/preflight.sh`                                                      |
| **Live probe (this agent)**                       | ⚠️ `www`/`dripplex.com` HTTP 200; **API + merchant/rider/admin/status not reachable** |

## 2. Deployment readiness

| Step                               | Artifact                                  |
| ---------------------------------- | ----------------------------------------- |
| Deploy Backend + migrate + portals | `scripts/cicd/pipeline.sh` (D2)           |
| Go-live orchestrator               | `scripts/golive/go-live.sh`               |
| Cache warm                         | `scripts/golive/warm-caches.sh`           |
| GitHub Deploy Production           | `.github/workflows/deploy-production.yml` |
| Release tag `v1.0.0`               | `.github/workflows/release-tag.yml`       |
| Runbook                            | `docs/ops/GO-LIVE.md`                     |

**Dry-run** executed in-repo (no `PROD_DEPLOY_HOST`). **Live cutover not executed** — no production SSH/host secrets in this environment.

## 3. Production validation pack

| Area                                                 | Status                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| Auth / portals / payments / wallet / orders          | ✅ Checklist `docs/ops/PRODUCTION-VALIDATION.md` |
| Expanded HTTP smoke (cart, fraud queue, CMS banners) | ✅ `scripts/cicd/smoke-test.sh`                  |
| Post-deploy validator                                | ✅ `scripts/golive/validate-production.sh`       |
| Manual smoke (RC1 checklist updated for GA)          | ✅ `docs/ops/SMOKE-CHECKLIST.md`                 |

## 4. Monitoring verification pack

Grafana / Prometheus / Loki / Sentry / Status — checklist in production validation + D3 docs. Live obs endpoints not publicly reachable from this agent (expected if VPN-only).

## 5. Version 1.0.0 publication (in-repo)

| Item                                                    | Status                                |
| ------------------------------------------------------- | ------------------------------------- |
| Workspace package versions → `1.0.0`                    | ✅                                    |
| Mobile versionName / marketing `1.0.0` (code `1000100`) | ✅                                    |
| K8s / env example image tags → `1.0.0`                  | ✅                                    |
| Release notes                                           | ✅ `docs/RELEASE-v1.0.0.md`           |
| Release manifest                                        | ✅ `docs/releases/v1.0.0.json`        |
| Git tag `v1.0.0` on `main`                              | ⏳ After merge + Release Tag workflow |

## 6. Remaining blockers (live cutover)

1. Production API + portal hosts not serving (DNS/edge/origin not live from agent probe).
2. GitHub `production` environment secrets (`PROD_DEPLOY_*`, DB, Redis, JWT, payments, SMTP, SMS, Sentry, Slack) not available to this agent.
3. Pre-migrate production backup + migrate window with on-call.
4. Payment **live** keys + webhook registration on `api.dripplex.com`.
5. Optional: Firebase/APNS if shipping mobile with GA (D4 still NOT READY for store).
6. Official brand assets still placeholders (does not block API go-live; blocks polished marketing/store).

## 7. Recommendation

### READY FOR GO-LIVE EXECUTION — NOT YET LIVE

The **v1.0.0 go-live package is complete**: version freeze, runbooks, preflight/validation scripts, expanded smoke, and CI deploy path.

**Do not claim production is live** until operators:

1. Complete `docs/ops/PRE-LAUNCH-CHECKLIST.md`
2. Publish/retag GHCR images for `v1.0.0`
3. Run **Deploy Production** (`confirm=promote-production`) or `EXECUTE=1 bash scripts/golive/go-live.sh`
4. Sign `docs/ops/PRODUCTION-VALIDATION.md`

### LIVE IN PRODUCTION

**No** — blocked on host/DNS/secrets (item §6).

---

## Quality gates

| Gate                          | Result                                  |
| ----------------------------- | --------------------------------------- |
| Typecheck                     | ✅                                      |
| Lint                          | ✅                                      |
| Tests                         | ✅ Backend 607                          |
| Go-live dry-run               | ✅                                      |
| Preflight against public prod | ⚠️ Expected failures (API/portals down) |
| Critical in-repo launch gaps  | **0** for packaging                     |

## Key paths

| Area           | Path                     |
| -------------- | ------------------------ |
| Program report | `docs/PROGRAM-D5.md`     |
| Release notes  | `docs/RELEASE-v1.0.0.md` |
| Go-live        | `docs/ops/GO-LIVE.md`    |
| Scripts        | `scripts/golive/`        |
