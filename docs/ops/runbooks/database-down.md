# Runbook — Database Down

**Alert:** `DatabaseDown`  
**Severity:** Critical

## Actions

1. Confirm `pg_isready` / postgres exporter on `data-01`.
2. Check disk space (DiskCritical often precedes DB fail).
3. Restart Postgres container only if safe; otherwise restore from B2 (`infrastructure/scripts/restore-postgres.sh`).
4. API will fail health until DB returns — keep portals in maintenance messaging via status page.
5. After recovery: verify `/api/v1/health`, run smoke suite.

Do **not** run ad-hoc schema changes. Schema is frozen.
