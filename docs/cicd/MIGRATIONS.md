# D2 — Migration automation

## Command

```bash
DATABASE_URL=... ./scripts/cicd/migrate.sh
# or via pipeline on deploy host / one-off container
```

Uses `pnpm exec prisma migrate deploy` + `prisma migrate status` for verification.

## Rules

- Staging and production only — never `migrate dev` in shared envs.
- Always take encrypted backup first (`infrastructure/scripts/backup-postgres.sh`).
- Schema remains frozen from Program A/C unless a later program unlocks migrations.

## Failure handling

| Failure                           | Action                                          |
| --------------------------------- | ----------------------------------------------- |
| migrate deploy error              | Abort pipeline; restore dump; notify            |
| status shows pending after deploy | Treat as failure                                |
| app boot fails after migrate      | Image rollback may be insufficient — restore DB |
