# D1 — Production topology

## High-level topology

```text
Internet
   │
Cloudflare (proxied orange-cloud)
   │  Full (strict) TLS · WAF · CDN · R2
   │
Hetzner floating IP / lb-01 (Nginx)
   ├─ www / apex        → customer-web:3001
   ├─ merchant.*        → merchant-portal:3002
   ├─ rider.*           → rider-portal:3003
   ├─ admin.*           → admin-portal:3004   (+ Cloudflare Access)
   ├─ api.*             → backend:3000  (upstream pool)
   └─ status.*          → uptime-kuma:3005

Private network 10.0.0.0/16
   ├─ backend / workers → postgres:5432 (via pgbouncer:6432)
   ├─ backend / workers → redis:6379
   └─ backend           → R2 (HTTPS egress)
```

## Service ports (internal)

| Service         | Port                 | Public?                  |
| --------------- | -------------------- | ------------------------ |
| nginx           | 80, 443              | Yes (Cloudflare only)    |
| customer-web    | 3001                 | No                       |
| merchant-portal | 3002                 | No                       |
| rider-portal    | 3003                 | No                       |
| admin-portal    | 3004                 | No                       |
| backend         | 3000                 | No                       |
| worker          | n/a (consumes Redis) | No                       |
| pgbouncer       | 6432                 | No                       |
| postgres        | 5432                 | No                       |
| redis           | 6379                 | No                       |
| prometheus      | 9090                 | No (Access/VPN)          |
| grafana         | 3006                 | No (Access/VPN)          |
| loki            | 3100                 | No                       |
| uptime-kuma     | 3005                 | Via status hostname only |

## Frontend cluster

Four Next.js apps, independently deployable images, shared `@dripplex/*` packages baked at build. Edge caching via Cloudflare for static `/_next/static`.

## Backend cluster

- NestJS API (`apps/backend`) — stateless; JWT in client; scale horizontally.
- Worker process(es) — same image, different command; consume Redis lists/streams for email/SMS/push/jobs.

## Data plane

- PostgreSQL 16 with volume encryption (LUKS or Hetzner volume encryption) + daily dump to B2 + WAL archive for PITR.
- Redis 7 with `requirepass`, AOF+RDB, private bind.
- R2 buckets: `dripplex-uploads`, `dripplex-cms`, `dripplex-private-docs` (presigned / Worker gate).

## Failure domains

| Failure         | Impact              | Mitigation                         |
| --------------- | ------------------- | ---------------------------------- |
| Single app node | Portals/API degrade | Second app node + LB upstream      |
| Data node       | Full outage         | Restore from B2; RTO targets in DR |
| Cloudflare      | Edge down           | Rare; status communication         |
| R2              | Media miss          | Cached CDN; retry                  |

Compose file: `infrastructure/docker/docker-compose.production.yml`  
K8s: `infrastructure/kubernetes/`
