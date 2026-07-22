# Go-Live runbook — Dripplex v1.0.0

Production launch only. No feature work, no API/schema changes, no UI redesign, no infra redesign.

## Prerequisites

1. `docs/ops/PRE-LAUNCH-CHECKLIST.md` signed
2. Images published for tag `v1.0.0` (or SHA) in GHCR
3. Staging validated on equivalent commit
4. On-call engineer named; rollback owner named (`docs/ops/ROLLBACK.md`)

## Recommended path (GitHub Actions)

1. **Release Tag** workflow → version `1.0.0` (creates `v1.0.0`)
2. **Publish Images** for that tag (if not already)
3. **Deploy Production** with:
   - `image_tag` = `v1.0.0` (or digest SHA)
   - `confirm` = `promote-production`
4. Watch Slack / Actions logs
5. Run `docs/ops/PRODUCTION-VALIDATION.md` + smoke checklist

## Local / SSH path

```bash
export EXECUTE=1
export IMAGE_TAG=v1.0.0
export PROD_DEPLOY_HOST=...
export PROD_DEPLOY_USER=...
# SSH key in agent or PROD_SSH_KEY for CI
export API_BASE_URL=https://api.dripplex.com/api/v1
export CUSTOMER_URL=https://www.dripplex.com
export MERCHANT_URL=https://merchant.dripplex.com
export RIDER_URL=https://rider.dripplex.com
export ADMIN_URL=https://admin.dripplex.com
export SMOKE_STRICT=1

# Dry-run first
EXECUTE=0 bash scripts/golive/go-live.sh

# Live cutover
bash scripts/golive/go-live.sh
bash scripts/golive/warm-caches.sh
```

## Deployment order (executed by `pipeline.sh`)

1. Persist previous image tag (rollback pointer)
2. Pre-migrate backup (best effort)
3. Pull GHCR images (backend + 4 portals)
4. `prisma migrate deploy`
5. Compose up production stack
6. Health checks (`/api/v1/health` + portals)
7. Smoke suite (`scripts/cicd/smoke-test.sh`, strict)
8. Auto-rollback on failure

## Post-cutover (T+0 → T+1h)

| Window | Action                                 |
| ------ | -------------------------------------- |
| T+0    | Health + smoke green                   |
| T+5m   | Grafana overview — error rate, latency |
| T+15m  | Sentry — no new critical spikes        |
| T+30m  | Spot-check auth + payment test txn     |
| T+1h   | Status page green; announce go-live    |

## Abort criteria

Abort / rollback immediately if:

- API health fails after retries
- Smoke suite fails under `SMOKE_STRICT=1`
- Payment webhooks error > threshold
- Error budget burn (5xx) exceeds launch SLO (see `docs/ops/sla/SLA-SLO.md`)

## Communications

Template:

```
Dripplex v1.0.0 is LIVE.
Surfaces: www / api / merchant / rider / admin
Status: https://status.dripplex.com
Issues: support@dripplex.com · on-call Slack
```
