# Program D — Phase D1: Production Infrastructure

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| **Program**      | D — Production Launch                               |
| **Phase**        | D1 — Production Infrastructure                      |
| **Status**       | Complete — awaiting review before D2                |
| **Branch**       | `cursor/program-d1-production-infrastructure-1b33`  |
| **Base**         | C4 RC1 (`cursor/program-c4-release-candidate-1b33`) |
| **Last updated** | 2026-07-22                                          |

## Constraints honored

- No application features
- No UI changes
- No Backend API / schema / SDK changes
- Infrastructure only

## Recommended production stack (adopted)

| Layer           | Choice                              | Role                                 |
| --------------- | ----------------------------------- | ------------------------------------ |
| Edge            | Cloudflare                          | DNS, CDN, SSL, WAF, DDoS             |
| Compute         | Hetzner Cloud                       | App + worker VMs (EU/FSN or HEL)     |
| Database        | PostgreSQL 16                       | Primary datastore + pooling          |
| Cache / queue   | Redis 7                             | Sessions, rate limits, job queues    |
| Object storage  | Cloudflare R2                       | Uploads, logos, CMS (no egress fees) |
| Off-site backup | Backblaze B2                        | Encrypted DB/config replicas         |
| Runtime         | Docker Compose (launch) → K8s-ready | Containers                           |
| CI/CD           | GitHub Actions                      | Staging + production pipelines       |
| Metrics         | Prometheus + Grafana                | CPU, mem, DB, Redis, API             |
| Logs            | Loki + Promtail + Grafana           | Centralized logs                     |
| Uptime          | Uptime Kuma                         | Internal probes + status page        |
| Errors          | Sentry                              | API + portal crash reporting         |

---

## Deliverable index

| #   | Deliverable                     | Path                                                                   |
| --- | ------------------------------- | ---------------------------------------------------------------------- |
| 1   | Infrastructure diagram          | `docs/diagrams/d1-architecture.md`                                     |
| 2   | Server specification            | `docs/infrastructure/SERVER-SPEC.md`                                   |
| 3   | Production topology             | `docs/infrastructure/TOPOLOGY.md`                                      |
| 4   | Cloudflare configuration        | `docs/infrastructure/CLOUDFLARE.md` + `infrastructure/cloudflare/`     |
| 5   | Docker infrastructure           | `infrastructure/docker/`                                               |
| 6   | Production Compose / Kubernetes | `docker-compose.production.yml` + `infrastructure/kubernetes/`         |
| 7   | Database backup strategy        | `docs/infrastructure/DATABASE.md`                                      |
| 8   | Redis strategy                  | `docs/infrastructure/REDIS.md`                                         |
| 9   | Monitoring stack                | `docs/infrastructure/MONITORING.md` + `infrastructure/monitoring/`     |
| 10  | Logging stack                   | `docs/infrastructure/LOGGING.md` + `infrastructure/logging/`           |
| 11  | Alerting rules                  | `docs/infrastructure/ALERTING.md` + `infrastructure/monitoring/rules/` |
| 12  | Security checklist              | `docs/infrastructure/SECURITY.md`                                      |
| 13  | Disaster recovery plan          | `docs/infrastructure/DISASTER-RECOVERY.md`                             |
| 14  | Estimated monthly cost          | `docs/infrastructure/COST-ESTIMATE.md`                                 |
| 15  | Deployment readiness report     | `docs/infrastructure/DEPLOYMENT-READINESS.md`                          |

---

## Domains

| Host                    | Target                               |
| ----------------------- | ------------------------------------ |
| `dripplex.com`          | Apex → Customer (or redirect to www) |
| `www.dripplex.com`      | Customer Web                         |
| `api.dripplex.com`      | Backend Core API / LB                |
| `merchant.dripplex.com` | Merchant Portal                      |
| `rider.dripplex.com`    | Rider Portal                         |
| `admin.dripplex.com`    | Admin Portal (Access-restricted)     |
| `status.dripplex.com`   | Uptime Kuma public status            |

SSL: Cloudflare **Full (strict)**, TLS 1.3, Universal SSL + origin certs, HSTS preload-ready.

---

## What was added in-repo

- Production Docker Compose (edge nginx, frontends, API, workers, Postgres, Redis, monitoring, logging)
- Kubernetes base manifests (Deployments, Services, HPA, Ingress placeholders) — autoscaling-ready
- Nginx reverse-proxy configs for LB → services
- Prometheus / Alertmanager / Grafana / Loki / Promtail configs + alert rules
- Cloudflare DNS / WAF / R2 / SSL runbook + Terraform-ready variables
- Backup / restore scripts (Postgres + Redis → B2)
- Secrets inventory + rotation policy
- GitHub Actions: `deploy-staging.yml`, `deploy-production.yml`
- DR plan with RTO/RPO targets

## Explicitly not done in D1

- Live Cloudflare zone provisioning (requires account credentials)
- Live Hetzner VM purchase
- D2 application hardening / go-live cutover
- Changing Backend Core or portal application code

## Recommendation

**Infrastructure design READY FOR REVIEW.**  
Do **not** start D2 until this package is approved.
