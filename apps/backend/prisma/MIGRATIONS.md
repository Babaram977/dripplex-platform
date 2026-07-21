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

---

# Migration notes — S1-C2 registration & verification

Migration: `20260721110000_s1_c2_registration_verification`

## Summary

Additive migration on top of S1-C1.

| Change type | Detail                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| Enum        | `OnboardingStatus` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`) |
| Table       | `audit_logs`                                                                      |
| Table       | `merchant_onboarding`, `rider_onboarding`, `driver_onboarding`                    |
| Index       | Audit log query indexes; onboarding status indexes                                |

## API surface (S1-C2)

| Method | Path                      | Description                           |
| ------ | ------------------------- | ------------------------------------- |
| POST   | `/auth/register/customer` | Customer self-registration            |
| POST   | `/auth/register/merchant` | Merchant self-registration            |
| POST   | `/auth/register/rider`    | Rider self-registration (phone req.)  |
| POST   | `/auth/register/driver`   | Driver self-registration (phone req.) |
| POST   | `/auth/verify/email`      | Email OTP verification (no JWT)       |
| POST   | `/auth/verify/phone`      | Phone OTP verification (no JWT)       |

## Verification checklist (S1-C2)

- [ ] Portal registration creates profile + onboarding `DRAFT` where applicable
- [ ] Registration returns verification info without tokens
- [ ] Email/phone verification updates `emailVerifiedAt` / `phoneVerifiedAt`
- [ ] `User.status` transitions to `ACTIVE` when required verifications complete
- [ ] Audit events written for registration and OTP lifecycle

---

# Migration notes — S1-C3 login & session foundation

Migration: `20260721120000_s1_c3_login_session`

## Summary

Additive migration on top of S1-C2.

| Change type | Detail                                                   |
| ----------- | -------------------------------------------------------- |
| Column      | `users.last_active_at`                                   |
| Column      | `auth_sessions.portal` (`RegistrationChannel`, NOT NULL) |
| Column      | `auth_sessions.last_active_at`                           |
| Column      | `auth_sessions.refresh_token_hash` nullable              |
| Index       | `auth_sessions.portal`                                   |

## API surface (S1-C3)

| Method | Path                   | Description                    |
| ------ | ---------------------- | ------------------------------ |
| POST   | `/auth/login/customer` | Customer portal login (no JWT) |
| POST   | `/auth/login/merchant` | Merchant portal login (no JWT) |
| POST   | `/auth/login/rider`    | Rider portal login (no JWT)    |
| POST   | `/auth/login/driver`   | Driver portal login (no JWT)   |

## Verification checklist (S1-C3)

- [ ] Successful login creates `auth_sessions` row with `refresh_token_hash IS NULL`
- [ ] Login rejects `PENDING_VERIFICATION`, `BLOCKED`, `SUSPENDED`, deleted users
- [ ] Portal role mismatch returns `WRONG_PORTAL`
- [ ] Failed login attempts tracked in Redis with lockout
- [ ] Audit events: `auth.login.started`, `auth.login.success`, `auth.login.failed`, `auth.session.created`
- [ ] No JWT or refresh token in login response
