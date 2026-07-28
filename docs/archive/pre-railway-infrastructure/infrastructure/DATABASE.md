# D1 — Database strategy (PostgreSQL)

## Production PostgreSQL

| Item                  | Spec                                                         |
| --------------------- | ------------------------------------------------------------ |
| Engine                | PostgreSQL 16                                                |
| Hosting               | Hetzner `data-01` Docker (launch); managed PG optional later |
| Encryption at rest    | Volume encryption (Hetzner) + disk LUKS recommended          |
| Encryption in transit | TLS to clients inside private net (optional stunnel/pg TLS)  |
| Auth                  | Strong password / SCRAM; no public listen                    |
| Schema                | Frozen RC1 migrations via `prisma migrate deploy` only       |

## Connection pooling

| Item                   | Spec                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pooler                 | PgBouncer (`transaction` mode for Prisma-compatible settings; use `session` if prepared statements conflict — validate in staging) |
| Listen                 | `6432` private                                                                                                                     |
| Default pool size      | 50                                                                                                                                 |
| Max client connections | 200                                                                                                                                |
| App `DATABASE_URL`     | Point at pgbouncer, not direct Postgres                                                                                            |

Compose service: `pgbouncer` in `docker-compose.production.yml`.  
Config: `infrastructure/docker/postgres/pgbouncer.ini`.

## Readiness checks

| Check     | Method                                     |
| --------- | ------------------------------------------ |
| Container | `pg_isready`                               |
| API       | `GET /api/v1/health` includes DB component |
| Pooler    | TCP + `SHOW POOLS`                         |

## Backups

| Type                     | Cadence              | Retention                         | Location                                  |
| ------------------------ | -------------------- | --------------------------------- | ----------------------------------------- |
| Logical `pg_dump` custom | Daily 02:00 WAT      | 30 days                           | Backblaze B2 `dripplex-backups/postgres/` |
| WAL archiving            | Continuous           | ≥7 days                           | B2 `.../wal/` (PITR)                      |
| Pre-migrate snapshot     | On every prod deploy | Until next successful deploy + 7d | B2                                        |

Scripts:

- `infrastructure/scripts/backup-postgres.sh`
- `infrastructure/scripts/restore-postgres.sh`
- `infrastructure/scripts/wal-archive.sh`

## Point-in-Time Recovery (PITR)

1. Restore base backup nearest before incident.
2. Replay WAL to target timestamp.
3. Promote restored instance on private IP; update secrets; bounce API.
4. Validate with health + smoke checklist.

## Encryption at rest

- Hetzner Cloud Volume encryption enabled for `pg-data`.
- Backup objects uploaded with SSE-B / client-side `age` or `gpg` before B2 put.

## Migration automation

CI production workflow:

1. Take pre-migrate dump.
2. `pnpm --filter @dripplex/backend prisma:migrate:deploy`
3. Deploy new API image.
4. Health gate; auto-rollback API image on failure (DB forward-only — restore dump if migrate fails).
