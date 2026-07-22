# D2 — Rollback guide

## Automatic

`scripts/cicd/pipeline.sh` traps non-zero exit after deploy/health/smoke and calls `rollback.sh`, which:

1. Reads `/var/lib/dripplex/previous-image-tag`
2. Re-runs deploy with that tag (`SKIP_BACKUP=1`)
3. Notifies Slack (`rollback`)

Triggers:

- Health checks fail
- Critical smoke tests fail (`SMOKE_STRICT=1`)
- Deploy command failure
- Migration failure (pipeline exits before healthy traffic; rollback images; DB restore is manual if migrate applied)

## Manual

```bash
export DRIPPLEX_ENV=staging   # or production
export DEPLOY_MODE=ssh
export DEPLOY_HOST=...
export DEPLOY_USER=...
export ROLLBACK_TAG=<known-good-sha>
./scripts/cicd/rollback.sh "operator initiated"
./scripts/cicd/health-check.sh
./scripts/cicd/smoke-test.sh
```

## Database

Prisma migrations are forward-only. If a migration breaks production:

1. Do not rely on image rollback alone if schema changed.
2. Restore from pre-migrate encrypted dump (`infrastructure/scripts/restore-postgres.sh`).
3. Redeploy previous app tag matching schema.
4. See `docs/ops/ROLLBACK.md` and `docs/infrastructure/DISASTER-RECOVERY.md`.
