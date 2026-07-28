# D1 — Logging stack

## Stack

| Component | Role                             |
| --------- | -------------------------------- |
| Promtail  | Ship container/host logs         |
| Loki      | Log aggregation                  |
| Grafana   | Explore / correlate with metrics |

Configs: `infrastructure/logging/`.

## Log classes

| Class        | Source                                 | Retention             |
| ------------ | -------------------------------------- | --------------------- |
| Request logs | Nginx access                           | 14–30 days            |
| Error logs   | API / portals stderr                   | 30 days               |
| Audit logs   | Backend `AuditService` (DB + log ship) | 90+ days (compliance) |
| Worker logs  | Worker containers                      | 30 days               |

## Labels

`job`, `service`, `env`, `host`, `level`.

## PII

- Scrub Authorization headers in Promtail pipeline.
- Do not log raw card data (payments stay with providers).

## Centralization

All production hosts run Promtail → Loki on `obs-01`. Grafana datasource pre-provisioned.
