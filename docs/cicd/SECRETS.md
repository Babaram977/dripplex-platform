# D2 — Secret management guide

## Principles

- Never commit secrets (`.gitignore` covers `.env`, `.env.production`, `*.pem`).
- Use GitHub Environments: `staging`, `production` (protection rules on prod).
- Rotate per `docs/infrastructure/SECRETS.md` / `infrastructure/secrets/inventory.md`.

## GitHub Secrets (suggested)

| Secret                                                            | Environments        |
| ----------------------------------------------------------------- | ------------------- |
| `STAGING_DEPLOY_HOST` / `STAGING_DEPLOY_USER` / `STAGING_SSH_KEY` | staging             |
| `PROD_DEPLOY_HOST` / `PROD_DEPLOY_USER` / `PROD_SSH_KEY`          | production          |
| `SLACK_WEBHOOK_URL`                                               | both                |
| `DATABASE_URL`                                                    | both (or host-only) |
| `REDIS_URL`                                                       | both                |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`                        | both                |
| `CLOUDFLARE_API_TOKEN`                                            | ops / IaC           |
| `HETZNER_API_TOKEN`                                               | ops / IaC           |
| `R2_*` / `B2_*`                                                   | both                |
| SMTP / SMS / Push provider keys                                   | both                |

## GitHub Variables

| Variable               | Example                                   |
| ---------------------- | ----------------------------------------- |
| `DEPLOY_MODE`          | `ssh` or `dry-run`                        |
| `STAGING_API_BASE_URL` | `https://api.staging.dripplex.com/api/v1` |
| `PROD_API_BASE_URL`    | `https://api.dripplex.com/api/v1`         |
| Portal URL vars        | `STAGING_*_URL` / `PROD_*_URL`            |

## Cloudflare / Hetzner

Stored only in GitHub or Doppler — used by D1 IaC / firewall sync scripts, not embedded in images.

## JWT / DB / Redis

Injected at container runtime via Compose `env_file` on the host or secret manager → env — never baked into Docker layers.
