# Migration notes — S1-C1 identity foundation

Migration: `20260721100000_s1_c1_identity_foundation`

## Summary

Additive migration on top of Sprint 0.1 `20260721000000_init_auth`.

| Change type | Detail                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| Enum        | Add `RegistrationChannel`                                                           |
| Enum        | Add `UserStatus` value `BLOCKED`                                                    |
| Table       | `auth_sessions`                                                                     |
| Table       | `customer_profiles`, `merchant_profiles`, `rider_profiles`, `driver_profiles`       |
| Column      | `users.registration_channel`, `password_changed_at`, `blocked_at`, `blocked_reason` |
| Index       | User verification and session query indexes                                         |
| Data        | Backfill `registration_channel = CUSTOMER_WEB` where null                           |

## Apply

```bash
pnpm --filter @dripplex/backend prisma:migrate:deploy
pnpm --filter @dripplex/backend prisma:seed
```

Development:

```bash
pnpm --filter @dripplex/backend prisma:migrate:dev
```

## Repeatability

- `prisma migrate deploy` is idempotent: already-applied migrations are skipped.
- `prisma db seed` uses `upsert` for roles, permissions, and grants.

## Rollback strategy

S1-C1 is **forward-only** in shared environments. Roll back only in isolated development databases.

### Development rollback (destructive)

```bash
# Drop Sprint 1 tables and columns manually, or reset the database:
pnpm --filter @dripplex/backend exec prisma migrate reset
```

`migrate reset` drops all data, reapplies all migrations, and runs the seed.

### Production rollback

Do **not** drop enums or columns in production without a follow-up migration. If rollback is required:

1. Deploy a new migration that drops foreign keys and tables in reverse order:
   - `driver_profiles`, `rider_profiles`, `merchant_profiles`, `customer_profiles`
   - `auth_sessions`
   - User columns added in S1-C1
2. `BLOCKED` enum values cannot be removed from PostgreSQL enums without recreation — plan accordingly before production deploy.

## Verification checklist

- [ ] `prisma migrate deploy` succeeds
- [ ] `prisma db seed` completes twice without duplicate grants
- [ ] Existing `users` rows retain data; `registration_channel` backfilled
- [ ] `pnpm --filter @dripplex/backend test` passes
