# D1 — Alerting rules

Alertmanager routes to Slack/email/Pager (configure receivers in secrets).

Rules file: `infrastructure/monitoring/rules/dripplex-alerts.yml`.

## Required alerts

| Alert        | Condition                                    | Severity                |
| ------------ | -------------------------------------------- | ----------------------- |
| ServerDown   | `up == 0` for node 2m                        | critical                |
| DatabaseDown | postgres exporter / health DB fail 2m        | critical                |
| RedisDown    | redis ping fail 2m                           | critical                |
| ApiFailure   | health probe fail OR nginx 5xx ratio > 5% 5m | critical                |
| HighCPU      | CPU > 85% 10m                                | warning                 |
| HighMemory   | Mem > 90% 10m                                | warning                 |
| DiskFull     | Disk > 85% 5m                                | warning; > 95% critical |
| SslExpiry    | probe SSL days left < 14                     | warning                 |
| QueueBacklog | queue depth high 10m                         | warning                 |

## Uptime Kuma

- Monitors all public hostnames + API health
- Publishes `status.dripplex.com`
- Notifies same Slack channel

## On-call

Document rotation in ops wiki; D1 provides technical hooks only.
