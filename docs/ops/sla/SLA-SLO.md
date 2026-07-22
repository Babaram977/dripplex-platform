# SLA / SLO summary (Program D3)

Targets for **production** launch. Measured monthly unless noted.

## Service level objectives

| SLO                         | Target                                 | Measurement                                       |
| --------------------------- | -------------------------------------- | ------------------------------------------------- |
| Availability (API)          | **99.5%** monthly                      | blackbox `api.dripplex.com/api/v1/health` success |
| Availability (Customer web) | **99.5%** monthly                      | blackbox `www.dripplex.com`                       |
| API success rate            | **≥ 99.0%** non-5xx                    | nginx status codes (exclude probes)               |
| API latency p95             | **≤ 800 ms** (read); **≤ 2 s** (write) | nginx / Sentry transactions                       |
| Auth success path           | Login p95 **≤ 1.5 s**                  | Sentry / logs                                     |

## Incident response SLOs

| Item                    | Target       |
| ----------------------- | ------------ |
| SEV-1 acknowledge       | ≤ 15 minutes |
| SEV-1 mitigate / update | ≤ 60 minutes |
| SEV-2 acknowledge       | ≤ 30 minutes |
| Post-incident report    | ≤ 72 hours   |

## Recovery (aligned with D1 DR)

| Metric               | Target                   |
| -------------------- | ------------------------ |
| RTO                  | ≤ 4 hours                |
| RPO (Postgres)       | ≤ 1 hour                 |
| RPO (Redis sessions) | ≤ 24 hours (re-login OK) |

## SLA (customer-facing commitment)

Until commercial contracts define stricter terms, public ops target equals the SLOs above. Status page is source of truth for incident history.

## Error budget

At 99.5% monthly availability ≈ **3.6 hours** downtime budget. Freeze non-critical deploys when budget < 25% remaining in the month.
