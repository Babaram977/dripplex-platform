# D1 — Secrets management

## Principles

- No secrets in git (only templates).
- Production secrets in **Doppler** or **Infisical** or host env files on encrypted disk with 0600 perms (launch) → migrate to manager ASAP.
- Least privilege IAM for Hetzner, Cloudflare, B2, R2, GitHub Actions OIDC.

## Inventory

See `infrastructure/secrets/inventory.md` for the full list (JWT, DB, Redis, payment, R2, Sentry, etc.).

## Rotation

| Secret                                     | Cadence                         | Procedure                                                |
| ------------------------------------------ | ------------------------------- | -------------------------------------------------------- |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 90 days                         | Dual-publish overlap window → force refresh → retire old |
| DB password                                | 90 days                         | Rotate PG role → update pgbouncer + apps → recycle       |
| Redis password                             | 90 days                         | Update Redis ACL → bounce clients                        |
| Payment provider keys                      | On provider schedule / incident | Update secret manager → bounce API                       |
| R2 / B2 keys                               | 180 days                        | Issue new → swap → revoke old                            |
| Cloudflare Origin CA                       | Before expiry                   | Reissue → reload nginx                                   |
| GitHub deploy keys                         | On staff change                 | Rotate                                                   |

## GitHub Actions

- Use environment secrets: `staging`, `production`
- Prefer OIDC to cloud where possible; otherwise encrypted repository/environment secrets
- Never echo secrets in logs

## Encryption keys

- Backup encryption: `age` recipient key in secret manager; private key offline / break-glass
- Document key custodian in DR plan
