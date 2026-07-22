# Runbook — API Errors / High 5xx

**Alert:** `ApiFailure` / `ApiHigh5xxRate`  
**Severity:** Critical / Warning

## Actions

1. Open Sentry (Backend project) — new issues / releases.
2. Grafana Backend dashboard — 5xx rate, latency.
3. Loki: `{service="backend"} |= "error"` last 30m.
4. Correlate with deploy (`/var/lib/dripplex/current-image-tag`).
5. If post-deploy → auto-rollback should have fired; if not, run `scripts/cicd/rollback.sh`.
6. If dependency (Paystack/DB/Redis) → follow respective runbook.
7. Status page if customer-visible > 5 minutes.
