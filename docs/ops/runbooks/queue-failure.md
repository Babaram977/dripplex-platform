# Runbook — Queue Failure / Backlog

**Alerts:** `QueueBacklog`, `QueueFailure`

## Actions

1. Inspect Redis list lengths for `queue:*` and `*:dlq`.
2. Check worker containers (`docker compose logs worker`).
3. Scale workers; fix poison messages in DLQ (do not drop financial jobs blindly).
4. Provider outages (SMTP/SMS) → switch to degraded mode / retry later.
5. Page backend on-call if DLQ growth continues 30m.
