# D1 — Redis strategy

## Roles

| Use                         | Key pattern / DB     | Notes                               |
| --------------------------- | -------------------- | ----------------------------------- |
| Session / refresh metadata  | DB 0                 | Align with Backend Core Redis usage |
| Rate limiting               | DB 0 / prefixed keys | Throttler / login attempts          |
| Job queue                   | DB 1 lists/streams   | Email, SMS, push, background jobs   |
| Notification fan-out buffer | DB 1                 | Short-lived                         |
| Ephemeral cache             | DB 2                 | Optional response cache             |

## Production settings

| Setting            | Value                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Image              | `redis:7-alpine`                                                                           |
| `requirepass`      | From secrets                                                                               |
| Bind               | Private interface only                                                                     |
| Persistence        | AOF `everysec` + daily RDB snapshot                                                        |
| `maxmemory`        | 2gb (CX42 headroom)                                                                        |
| `maxmemory-policy` | `allkeys-lru` for cache DB; no eviction on queue DB (separate instance preferred at scale) |
| TLS                | Optional stunnel; private net acceptable at launch                                         |

Config: `infrastructure/docker/redis/redis.conf`.

## Queue model (workers)

Workers (same backend image, `WORKER_MODE=true`) BRPOP/XREAD from:

| Queue         | Purpose                 |
| ------------- | ----------------------- |
| `queue:email` | Transactional email     |
| `queue:sms`   | OTP / SMS               |
| `queue:push`  | Push notifications      |
| `queue:jobs`  | Generic background jobs |

> D1 provisions Redis + worker container topology. Application producer/consumer wiring stays within locked Backend Core behaviour — no API changes. If queues are not yet fully implemented in Core, infrastructure is ready for D2 enablement.

## Backups

| Type         | Cadence         | Destination                  |
| ------------ | --------------- | ---------------------------- |
| RDB snapshot | Daily           | B2 `dripplex-backups/redis/` |
| AOF copy     | Optional hourly | B2                           |

Script: `infrastructure/scripts/backup-redis.sh`.

## Failover

Launch: single Redis. Growth: Redis Sentinel or managed Redis. Document RPO for Redis as **minutes** (sessions re-login acceptable).
