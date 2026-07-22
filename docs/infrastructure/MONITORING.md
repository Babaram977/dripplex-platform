# Monitoring stack (D1 + D3)

> Extended in **Program D3** — see `docs/PROGRAM-D3.md` and `docs/observability/ARCHITECTURE.md`.

## Components

| Component                                                     | Role                                        |
| ------------------------------------------------------------- | ------------------------------------------- |
| Prometheus                                                    | Metrics scrape + rules                      |
| Grafana                                                       | Dashboards (10 Dripplex boards)             |
| redis / postgres / node / nginx exporters, cAdvisor, blackbox | Exporters                                   |
| Uptime Kuma                                                   | Synthetic HTTP uptime + status page         |
| Sentry                                                        | Application errors + traces (env-gated SDK) |

Configs: `infrastructure/monitoring/`.

## Scrapes

| Job                 | Target             |
| ------------------- | ------------------ |
| prometheus          | self               |
| node                | app/data/obs nodes |
| cadvisor            | containers         |
| postgres            | postgres_exporter  |
| redis               | redis_exporter     |
| nginx               | nginx_exporter     |
| blackbox-https      | public hostnames   |
| blackbox-api-health | `/api/v1/health`   |

## Health endpoints

- `GET https://api.dripplex.com/api/v1/health` — DB + Redis
- Portal `/` — HTTP 200
- Uptime Kuma monitors + SSL expiry

## Dashboards

`infrastructure/monitoring/grafana/dashboards/` — Platform, Backend, Database, Redis, Frontend, Customer/Merchant/Rider/Admin activity, Infrastructure.

## Metrics checklist

| Metric                           | Source                    |
| -------------------------------- | ------------------------- |
| CPU / Memory / Disk / Network    | node_exporter             |
| Containers                       | cAdvisor                  |
| Database                         | postgres_exporter         |
| Redis / queues                   | redis_exporter            |
| Workers                          | queue metrics + logs      |
| API availability / latency / 5xx | blackbox + nginx + Sentry |
