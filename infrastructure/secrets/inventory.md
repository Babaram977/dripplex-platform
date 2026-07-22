# Secrets inventory (D1) — values live in secret manager, not git

| Key                                                           | Used by                  | Rotation                   |
| ------------------------------------------------------------- | ------------------------ | -------------------------- |
| `JWT_ACCESS_SECRET`                                           | backend                  | 90d                        |
| `JWT_REFRESH_SECRET`                                          | backend                  | 90d                        |
| `DATABASE_URL`                                                | backend, worker, backups | with DB password           |
| `POSTGRES_USER` / `POSTGRES_PASSWORD`                         | postgres, pgbouncer      | 90d                        |
| `REDIS_URL` / `REDIS_PASSWORD`                                | backend, worker, redis   | 90d                        |
| `CORS_ORIGINS`                                                | backend                  | on domain change           |
| `PAYSTACK_*` / `FLUTTERWAVE_*` / `MONIEPOINT_*`               | backend                  | provider                   |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | backend (uploads)        | 180d                       |
| `B2_KEY_ID` / `B2_APPLICATION_KEY`                            | backup scripts           | 180d                       |
| `AGE_RECIPIENT` / `AGE_IDENTITY`                              | backup encrypt/decrypt   | break-glass                |
| `SENTRY_DSN`                                                  | backend, portals         | on project rotate          |
| `GRAFANA_ADMIN_PASSWORD`                                      | grafana                  | 90d                        |
| `SLACK_WEBHOOK_URL`                                           | alertmanager             | on channel rotate          |
| `ORIGIN_TLS_CERT` / `ORIGIN_TLS_KEY`                          | nginx                    | before CF Origin CA expiry |
| `CLOUDFLARE_API_TOKEN`                                        | IaC / DNS automation     | staff change               |
| `GHCR` / registry creds                                       | CI deploy                | staff change               |

Template file for hosts: `infrastructure/secrets/.env.production.example`
