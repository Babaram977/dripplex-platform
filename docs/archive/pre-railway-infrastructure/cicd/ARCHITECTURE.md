# D2 — CI/CD architecture

```mermaid
flowchart LR
  DEV[Developer PR] --> CI[CI Validation<br/>typecheck lint test build audit]
  CI -->|merge main| PUB[Publish Images<br/>GHCR + Trivy]
  PUB --> STG[Staging Deploy<br/>migrate · health · smoke]
  STG -->|manual approve| PROD[Production Deploy<br/>confirm phrase + env protection]
  STG -->|fail| RB1[Auto Rollback]
  PROD -->|fail| RB2[Auto Rollback]
  PUB --> N1[Slack: release published]
  STG --> N2[Slack: success/fail]
  PROD --> N3[Slack: success/fail/rollback]
```

## Environments (isolated)

| Env         | Domains (example)        | Data                | Secrets                 | Monitoring      |
| ----------- | ------------------------ | ------------------- | ----------------------- | --------------- |
| Development | localhost                | local Compose       | `.env` (gitignored)     | optional        |
| Staging     | `*.staging.dripplex.com` | staging PG/Redis/R2 | GitHub `staging` env    | staging Grafana |
| Production  | `*.dripplex.com`         | prod PG/Redis/R2    | GitHub `production` env | prod Grafana    |

## Components

| Layer    | Tech                                        |
| -------- | ------------------------------------------- |
| CI       | GitHub Actions `ci.yml`                     |
| Registry | GHCR (`ghcr.io/<owner>/dripplex-*`)         |
| Deploy   | `scripts/cicd/pipeline.sh` over SSH/Compose |
| Validate | health + smoke HTTP suite                   |
| Notify   | Slack webhook                               |
| Rollback | previous image tag file on host             |

See also D1 topology: `docs/infrastructure/TOPOLOGY.md`.
