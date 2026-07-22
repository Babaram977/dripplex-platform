# D1 — Monitoring stack

## Components

| Component                                                           | Role                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Prometheus                                                          | Metrics scrape + rules                                                    |
| Grafana                                                             | Dashboards                                                                |
| redis_exporter / postgres_exporter / node_exporter / nginx_exporter | Exporters                                                                 |
| Uptime Kuma                                                         | Blackbox HTTP uptime + status page                                        |
| Sentry                                                              | Application errors (DSN via secrets; SDK enablement is D2 if not present) |

Configs: `infrastructure/monitoring/`.

## Scrapes

| Job        | Target                                                             |
| ---------- | ------------------------------------------------------------------ |
| prometheus | self                                                               |
| node       | app/data/obs nodes                                                 |
| postgres   | postgres_exporter                                                  |
| redis      | redis_exporter                                                     |
| nginx      | nginx_exporter                                                     |
| backend    | `/metrics` if exposed later; else rely on node + blackbox + health |

## Health endpoints

- `GET https://api.dripplex.com/api/v1/health` — DB + Redis
- Portal `/` — HTTP 200
- Uptime Kuma monitors above + SSL expiry

## Dashboards

- Node resources (CPU, memory, disk)
- PostgreSQL connections / lag
- Redis memory / connected clients
- Nginx request rate / 5xx
- Queue depth (Redis)

JSON placeholders: `infrastructure/monitoring/grafana/dashboards/`.

## Metrics checklist (from D1 brief)

| Metric   | Source                                    |
| -------- | ----------------------------------------- |
| CPU      | node_exporter                             |
| Memory   | node_exporter                             |
| Disk     | node_exporter                             |
| Database | postgres_exporter                         |
| Redis    | redis_exporter                            |
| API      | health + nginx 5xx + (future) app metrics |
