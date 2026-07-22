# Infrastructure — Program D1

Production-grade topology for Dripplex (Cloudflare + Hetzner + Docker + optional Kubernetes).

## Quick links

| Topic                | Path                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Program report       | [`docs/PROGRAM-D1.md`](../docs/PROGRAM-D1.md)                                                   |
| Architecture diagram | [`docs/diagrams/d1-architecture.md`](../docs/diagrams/d1-architecture.md)                       |
| Deployment readiness | [`docs/infrastructure/DEPLOYMENT-READINESS.md`](../docs/infrastructure/DEPLOYMENT-READINESS.md) |
| Production Compose   | [`docker/docker-compose.production.yml`](docker/docker-compose.production.yml)                  |
| Staging Compose      | [`docker/docker-compose.staging.yml`](docker/docker-compose.staging.yml)                        |
| Nginx LB             | [`nginx/dripplex.conf`](nginx/dripplex.conf)                                                    |
| Kubernetes           | [`kubernetes/`](kubernetes/)                                                                    |
| Monitoring           | [`monitoring/`](monitoring/)                                                                    |
| Logging              | [`logging/`](logging/)                                                                          |
| Cloudflare           | [`cloudflare/`](cloudflare/)                                                                    |
| Backup scripts       | [`scripts/`](scripts/)                                                                          |
| CI/CD (D2)           | [`docs/PROGRAM-D2.md`](../docs/PROGRAM-D2.md) · [`scripts/cicd/`](../scripts/cicd/)             |
| Secrets template     | [`secrets/.env.production.example`](secrets/.env.production.example)                            |

## Launch path

1. Review & approve `docs/PROGRAM-D1.md`.
2. Provision Hetzner nodes per `docs/infrastructure/SERVER-SPEC.md`.
3. Configure Cloudflare per `docs/infrastructure/CLOUDFLARE.md`.
4. Load secrets from `secrets/.env.production.example`.
5. `docker compose -f infrastructure/docker/docker-compose.production.yml --env-file .env.production up -d`
6. Enable observability profile: `--profile observability`
7. Run backup restore drill before production traffic.

## CI/CD

- Quality: `.github/workflows/ci.yml`
- Staging: `.github/workflows/deploy-staging.yml`
- Production: `.github/workflows/deploy-production.yml`

**Wait for D1 review before D2.**
