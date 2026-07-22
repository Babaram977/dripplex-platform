# Incident response plan (Program D3)

## Severity levels

| Sev       | Definition                                       | Response                         | Examples                                        |
| --------- | ------------------------------------------------ | -------------------------------- | ----------------------------------------------- |
| **SEV-1** | Full outage or data risk; majority users blocked | Immediate all-hands; status page | API down, DB down, payments broken              |
| **SEV-2** | Major feature degraded; workaround exists        | 15 min ack; active mitigation    | High 5xx, Redis down with re-login, queue stuck |
| **SEV-3** | Minor degradation / single portal                | Business hours                   | One portal slow, non-critical alert noise       |
| **SEV-4** | Cosmetic / low risk                              | Ticket                           | Dashboard gap, doc fix                          |

## Escalation matrix

| Time   | SEV-1                                      | SEV-2             |
| ------ | ------------------------------------------ | ----------------- |
| 0 min  | On-call engineer ack                       | On-call ack       |
| 15 min | Escalate eng lead                          | Stay with on-call |
| 30 min | Escalate founder/ops lead + status cadence | Eng lead optional |
| 60 min | External comms owner                       | —                 |

Channels: Slack `#dripplex-oncall`, Pager/phone as configured.

## Response procedure

1. **Detect** — Alertmanager / Kuma / Sentry / human report
2. **Ack** — Claim incident thread
3. **Triage** — Sev + blast radius
4. **Mitigate** — Rollback / restart / failover (prefer known-good)
5. **Communicate** — Status page + internal updates every 30m (SEV-1)
6. **Resolve** — Probes green; smoke pass
7. **Review** — Incident report within 72h

## Maintenance procedures

1. Announce scheduled maintenance on status page ≥ 24h ahead when possible.
2. Prefer low-traffic WAT windows.
3. Take pre-change backup.
4. Use D2 deploy pipeline; never hot-edit production containers.
5. Post completion note + duration.

## Runbooks index

See `docs/ops/runbooks/`.
