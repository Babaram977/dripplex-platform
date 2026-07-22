# Backups & secret management (RC1)

## Database backup strategy

| Cadence                   | Target                          | Retention (staging)  | Retention (prod suggestion) |
| ------------------------- | ------------------------------- | -------------------- | --------------------------- |
| Pre-migrate / pre-release | Full logical dump               | Until release signed | 30 days                     |
| Daily                     | Full dump or managed snapshot   | 7 days               | 30 days                     |
| Continuous                | WAL / PITR if provider supports | Provider default     | ≥7 days PITR                |

### Logical dump (example)

```bash
pg_dump "$DATABASE_URL" --format=custom --file="dripplex-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store off-host (object storage) with encryption at rest.

## Restore procedure

1. Provision empty Postgres (or stop writers).
2. `pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump` (adjust for format).
3. Verify migration table matches expected RC1 head (`20260721220000_s1_c14_c23_stabilization`).
4. Start Redis flush only if session inconsistency requires it (users re-login).
5. Deploy matching backend tag; run health + smoke.

## Configuration backup

| Asset                          | Backup                              |
| ------------------------------ | ----------------------------------- |
| Non-secret env templates       | Git (`.env.example`, docs)          |
| Deploy compose / k8s manifests | Git (`infrastructure/`)             |
| Secret values                  | Secret manager version history only |
| TLS certs                      | Managed CA / ACM — not in git       |

## Secret management

- Never commit `.env` with real secrets (`.gitignore` enforced).
- Staging/prod: inject via platform secrets (AWS SM, GCP SM, Doppler, etc.).
- Rotate `JWT_*` and payment keys on schedule; document rotation owner.
- Payment webhooks: store `FLUTTERWAVE_WEBHOOK_HASH` / provider secrets separately from public keys.
- Access: least privilege; audit who can read prod secrets.

## RC1 verification checklist

- [ ] Pre-deploy dump taken and upload verified
- [ ] Restore drill documented (at least once on staging)
- [ ] Secret manager versions labeled `rc1`
- [ ] Redis persistence or accepted ephemeral sessions documented
