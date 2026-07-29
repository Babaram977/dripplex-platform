# D1 — Disaster recovery plan

## Objectives

| Metric  | Target (launch)                            | Notes                                                 |
| ------- | ------------------------------------------ | ----------------------------------------------------- |
| **RTO** | ≤ 4 hours                                  | Time to restore API + customer web to serving traffic |
| **RPO** | ≤ 1 hour (DB); ≤ 24 hours (Redis sessions) | WAL/PITR for Postgres; Redis re-login acceptable      |

Tighten RTO/RPO after HA Postgres is funded.

## Scenarios

### 1. Single app node failure

1. LB marks upstream down.
2. Traffic to remaining app node / restart Compose on spare.
3. RTO minutes.

### 2. Data node failure

1. Declare incident; freeze writes if split-brain risk.
2. Provision replacement volume/host.
3. Restore latest base backup + WAL to target time (`restore-postgres.sh`).
4. Restore Redis RDB if needed (or cold start).
5. Point private DNS / Compose to new data host; start API.
6. Verify `/api/v1/health` + smoke.

### 3. Region / provider outage (Hetzner)

1. Communicate via status page.
2. Rebuild from IaC docs + B2 backups in alternate Hetzner location or secondary provider.
3. Update Cloudflare A records to new LB IP.
4. RTO may exceed 4h — executive accept.

### 4. Cloudflare account issue

1. Temporary DNS to origin (security degraded) only if approved.
2. Prefer Cloudflare support escalation.

### 5. Ransomware / data corruption

1. Isolate network.
2. Restore DB from **immutable** B2 version prior to infection.
3. Rotate all secrets.
4. Audit logs for forensics.

## Recovery procedures (quick)

```bash
# On recovery host — see scripts for full flow
./infrastructure/scripts/restore-postgres.sh s3://dripplex-backups/postgres/LATEST.dump
docker compose -f infrastructure/docker/docker-compose.production.yml up -d
curl -fsS https://api.dripplex.com/api/v1/health
```

## Documentation inventory

| Doc          | Path                                       |
| ------------ | ------------------------------------------ |
| Topology     | `docs/infrastructure/TOPOLOGY.md`          |
| Server spec  | `docs/infrastructure/SERVER-SPEC.md`       |
| Backups      | `docs/infrastructure/DATABASE.md`          |
| Secrets      | `docs/infrastructure/SECRETS.md`           |
| This DR plan | `docs/infrastructure/DISASTER-RECOVERY.md` |

## Drill cadence

- Restore drill quarterly on staging
- Document results in `docs/ops/` after each drill
