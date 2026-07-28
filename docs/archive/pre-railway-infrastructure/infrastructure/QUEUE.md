# D1 — Queue & background workers

## Architecture

```text
API / domain events → Redis queues → worker replicas → providers (email/SMS/push) + DB side effects
```

## Queues

| Queue | Priority | Retry          | DLQ               |
| ----- | -------- | -------------- | ----------------- |
| Email | Normal   | 5× exp backoff | `queue:email:dlq` |
| SMS   | High     | 5×             | `queue:sms:dlq`   |
| Push  | Normal   | 3×             | `queue:push:dlq`  |
| Jobs  | Low      | 5×             | `queue:jobs:dlq`  |

## Worker deployment

- Image: same as `@dripplex/backend`
- Command / env: `WORKER_MODE=1` (or `node dist/worker.js` when available)
- Replicas: 1–2 at launch; scale on queue depth metric
- Compose service: `worker`
- K8s: `infrastructure/kubernetes/backend/worker-deployment.yaml`

## Observability

- Queue depth gauges in Prometheus (redis exporter)
- Alert when depth > threshold for 10m
- Failed jobs logged to Loki + optional Sentry

## Note on application freeze

D1 does **not** modify Backend Core. This document defines the production topology so D2 can enable workers without redesigning infra.
