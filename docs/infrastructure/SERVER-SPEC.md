# D1 — Server specification (Hetzner Cloud)

Launch profile for Nigeria-facing traffic with EU/HEL or FSN origin (low cost, Cloudflare absorbs edge latency). Scale vertically first, then horizontally via Compose replicas / K8s HPA.

## Environments

| Env        | Purpose                                            |
| ---------- | -------------------------------------------------- |
| Staging    | Single node Compose (app + data + lite monitoring) |
| Production | Split app / data / observability as below          |

## Production nodes (initial)

| Role      | Hetzner type | vCPU | RAM   | Disk                       | Count | Notes                                            |
| --------- | ------------ | ---- | ----- | -------------------------- | ----- | ------------------------------------------------ |
| `lb-01`   | CX22         | 2    | 4 GB  | 40 GB SSD                  | 1     | Nginx LB + Origin TLS; optional Hetzner LB later |
| `app-01`  | CX32         | 4    | 8 GB  | 80 GB SSD                  | 1     | API + workers (Docker)                           |
| `app-02`  | CX32         | 4    | 8 GB  | 80 GB SSD                  | 1     | Frontends (or second API for HA)                 |
| `data-01` | CX42         | 8    | 16 GB | 160 GB SSD + volume 200 GB | 1     | Postgres + Redis (private net only)              |
| `obs-01`  | CX22         | 2    | 4 GB  | 80 GB SSD                  | 1     | Prometheus, Grafana, Loki, Uptime Kuma           |

**Minimum launch (budget):** combine `lb+app` on one CX32 and `data+obs` on one CX42 — document single-AZ risk in DR plan.

## Network

| Item            | Spec                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| Private network | Hetzner Cloud Network `10.0.0.0/16`                                                     |
| App subnet      | `10.0.1.0/24`                                                                           |
| Data subnet     | `10.0.2.0/24`                                                                           |
| Firewall        | Allow 80/443 from Cloudflare IP ranges only; SSH from bastion/VPN; deny public DB/Redis |
| Floating IP     | Optional on LB for DNS stability                                                        |

## OS & runtime

| Item         | Spec                                         |
| ------------ | -------------------------------------------- |
| OS           | Ubuntu 24.04 LTS                             |
| Containers   | Docker Engine 27+ / Compose v2               |
| Node (build) | 22 LTS (CI); runtime images from Dockerfiles |
| Kernel       | unattended-upgrades security patches         |

## Storage volumes

| Volume           | Size   | Attach  | Use                           |
| ---------------- | ------ | ------- | ----------------------------- |
| `pg-data`        | 200 GB | data-01 | Postgres data + WAL           |
| `redis-data`     | 20 GB  | data-01 | Redis RDB/AOF                 |
| `backup-scratch` | 100 GB | data-01 | Dump staging before B2 upload |

## Autoscaling readiness

- API and portals are **stateless** (no local session files).
- Compose: scale `backend` / portal services behind nginx upstream.
- Kubernetes manifests include `HorizontalPodAutoscaler` (CPU 70%, memory 80%).
- Postgres/Redis remain single primary at launch; read replicas are a D2+ growth item.

## Capacity assumptions (launch)

| Metric             | Assumption                      |
| ------------------ | ------------------------------- |
| Concurrent API RPS | ~50–100 sustained               |
| Peak RPS           | ~300 (Cloudflare caches static) |
| DB connections     | PgBouncer pool 50–100           |
| Redis memory       | ≤2 GB working set initially     |
