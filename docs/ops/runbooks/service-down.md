# Runbook — Service Down

**Alert:** `ServiceDown` / `ServerDown`  
**Severity:** Critical

## Symptoms

- Blackbox / Uptime Kuma probe failing
- Status page component red
- Users cannot reach site or API

## Immediate actions (0–15 min)

1. Acknowledge alert in Slack `#dripplex-oncall`.
2. Check Uptime Kuma + Grafana **Platform Overview**.
3. Identify blast radius: edge (Cloudflare), LB/nginx, app nodes, or single hostname.
4. If Cloudflare 5xx → check CF status + origin health.
5. If origin down → SSH `app`/`lb` hosts; `docker compose ps`; restart unhealthy services.
6. Post status page update: Investigating.

## Escalate

- Sev-1 > 15 min unresolved → escalate per `docs/ops/INCIDENT-RESPONSE.md`
- Data plane involved → page DB on-call

## Resolve

1. Restore traffic; confirm probes green 5+ minutes.
2. Status page: Resolved + summary.
3. File incident report (`docs/ops/reports/incident-report-template.md`).
