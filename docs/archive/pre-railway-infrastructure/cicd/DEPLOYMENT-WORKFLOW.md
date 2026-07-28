# D2 — Deployment workflow

## Staging (automatic after publish)

1. `Publish Docker Images` succeeds on `main`.
2. `Deploy Staging` starts (or manual `workflow_dispatch` with `image_tag`).
3. SSH to staging host (or `DEPLOY_MODE=dry-run`).
4. Record previous tag → pull five images.
5. `prisma migrate deploy` (via migrate job / one-off container).
6. `docker compose up -d` (staging compose).
7. `health-check.sh` — API `/health` + portals.
8. `smoke-test.sh` — auth/customer/merchant/rider/admin probes.
9. On failure → `rollback.sh` → notify Slack.

## Production (manual)

1. Operator runs `Deploy Production`.
2. Must type `promote-production`.
3. GitHub Environment `production` requires reviewer approval.
4. CI re-runs as gate.
5. Same pipeline as staging against prod hosts/secrets.
6. Auto-rollback on health/smoke failure.
7. Success/failure Slack notification.

## Compose files

- Staging: `infrastructure/docker/docker-compose.staging.yml`
- Production: `infrastructure/docker/docker-compose.production.yml`

Image overrides: `BACKEND_IMAGE`, `CUSTOMER_IMAGE`, `MERCHANT_IMAGE`, `RIDER_IMAGE`, `ADMIN_IMAGE`.

## Host layout (expected)

```text
/opt/dripplex/                 # repo checkout or compose project
/var/lib/dripplex/current-image-tag
/var/lib/dripplex/previous-image-tag
```
