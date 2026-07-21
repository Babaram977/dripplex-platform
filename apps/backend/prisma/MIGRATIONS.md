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

---

# Migration notes — S1-C4 JWT, refresh tokens & session rotation

No new database migration — uses S1-C3 `auth_sessions` schema.

## Summary

| Change type | Detail                                                                |
| ----------- | --------------------------------------------------------------------- |
| API         | Portal login returns `accessToken`, `refreshToken`, `expiresIn`       |
| API         | `POST /auth/refresh` — session-bound rotation with reuse detection    |
| API         | `POST /auth/logout` — JWT-authenticated (no refresh token in body)    |
| API         | `POST /auth/logout-all` — revokes all sessions for authenticated user |
| Removed     | `POST /auth/login` (legacy Sprint 0.1)                                |
| JWT         | Payload: `sub`, `sid`, `role`, `portal`, `typ`, `iat`, `exp`          |
| JWT         | Permissions **not** embedded; loaded from DB in `JwtStrategy`         |
| Redis       | Refresh revocation removed; `auth_sessions.refresh_token_hash` only   |

## API surface (S1-C4)

| Method | Path               | Auth   | Description                         |
| ------ | ------------------ | ------ | ----------------------------------- |
| POST   | `/auth/refresh`    | Public | Rotate refresh token; issue new JWT |
| POST   | `/auth/logout`     | JWT    | Revoke current session              |
| POST   | `/auth/logout-all` | JWT    | Revoke all user sessions            |

## Breaking changes

- `POST /auth/login` removed — use portal-specific login endpoints.
- `POST /auth/logout` now requires `Authorization: Bearer <accessToken>` instead of refresh token body.
- Access tokens must include `sid` claim and match an active `auth_sessions` row.
- Legacy Sprint 0.1 JWTs (with `email`, `roles`, `permissions` claims) are rejected by the JWT guard.

## Verification checklist (S1-C4)

- [ ] Portal login returns `accessToken`, `refreshToken`, `expiresIn`, session metadata
- [ ] `auth_sessions.refresh_token_hash` populated on login (SHA-256)
- [ ] Refresh rotates token and overwrites hash
- [ ] Presenting a rotated refresh token revokes session and returns 401
- [ ] Logout revokes session and clears hash
- [ ] Logout-all revokes all sessions for user
- [ ] Revoked session access token rejected by JWT guard
- [ ] Audit events: `auth.refresh.started`, `auth.refresh.success`, `auth.refresh.failed`, `auth.refresh.reused`, `auth.logout`, `auth.logout.all`, `auth.session.revoked`

---

# Migration notes — S1-C5 password management

Migration: `20260721130000_s1_c5_password_management`

## Summary

| Change type   | Detail                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| Table         | `password_reset_tokens` (hash, user, expiry, createdAt, consumedAt)                         |
| API           | `POST /auth/password/forgot` — anti-enumeration, rate limited                               |
| API           | `POST /auth/password/reset` — token + OTP, revoke all sessions                              |
| API           | `POST /auth/password/change` — authenticated, revoke all sessions                           |
| Config        | `PASSWORD_RESET_TOKEN_TTL_SECONDS`, `PASSWORD_FORGOT_MAX_PER_HOUR`, `OTP_RESET_TTL_SECONDS` |
| Notifications | `NotificationService` abstraction (logging adapter)                                         |

## API surface (S1-C5)

| Method | Path                    | Auth   | Description                           |
| ------ | ----------------------- | ------ | ------------------------------------- |
| POST   | `/auth/password/forgot` | Public | Request reset; always `{ submitted }` |
| POST   | `/auth/password/reset`  | Public | Complete reset with token + OTP       |
| POST   | `/auth/password/change` | JWT    | Change password while authenticated   |

## Session revocation

Per DPX-013 §13.5, **password reset and password change revoke all sessions** for the user (including the current session on change). Clients must log in again.

## Verification checklist (S1-C5)

- [ ] Forgot password always returns `{ submitted: true }`
- [ ] Active user receives reset token (hashed in DB) + OTP via notification port
- [ ] One active reset token per user (prior tokens invalidated)
- [ ] Reset rejects invalid, expired, and reused tokens
- [ ] Reset/change update `passwordChangedAt` and revoke all sessions
- [ ] Password policy enforced (length, complexity, common denylist)
- [ ] Audit events: `auth.password.forgot`, `auth.password.reset.*`, `auth.password.changed`, `auth.password.change.failed`, `auth.sessions.revoked.password`

---

# Migration notes — S1-C6 identity verification

Migration: `20260721140000_s1_c6_identity_verification`

## Summary

| Change type   | Detail                                                             |
| ------------- | ------------------------------------------------------------------ |
| Enum          | `IdentityVerificationType` (`EMAIL`, `PHONE`)                      |
| Table         | `identity_verifications` (tokenHash, otpHash, expiry, attempts, …) |
| API           | `POST /auth/email/{send-verification,verify,resend}`               |
| API           | `POST /auth/phone/{send-otp,verify,resend}`                        |
| Config        | Email/phone TTL, hourly limits, max attempts (10), lockout (30m)   |
| Notifications | `sendEmailVerification`, `sendPhoneOtp` on `NotificationService`   |

## API surface (S1-C6)

| Method | Path                            | Auth   | Description                               |
| ------ | ------------------------------- | ------ | ----------------------------------------- |
| POST   | `/auth/email/send-verification` | Public | Issue HMAC-signed email token             |
| POST   | `/auth/email/verify`            | Public | Consume signed token; mark email verified |
| POST   | `/auth/email/resend`            | Public | Invalidate prior; issue new token         |
| POST   | `/auth/phone/send-otp`          | Public | Issue 6-digit OTP (hash stored)           |
| POST   | `/auth/phone/verify`            | Public | Verify OTP; mark phone verified           |
| POST   | `/auth/phone/resend`            | Public | Invalidate prior; issue new OTP           |

## Security notes

- Plaintext tokens/OTPs are never persisted
- Send/resend always return `{ submitted: true }` (anti-enumeration)
- Resend invalidates previous active challenge for that user + type
- Redis: hourly counters, resend cooldown, phone OTP lockout

## Verification checklist (S1-C6)

- [ ] Email send creates `identity_verifications` row with `token_hash`
- [ ] Email verify rejects invalid, expired, and reused tokens
- [ ] Email resend invalidates previous challenge
- [ ] Phone send stores `otp_hash` only
- [ ] Phone verify enforces attempt limits and lockout
- [ ] Phone resend invalidates previous OTP
- [ ] Audit events: `auth.email.*`, `auth.phone.*`, `auth.verification.expired`

---

# Migration notes — S1-C7 device management & session dashboard

No new database migration — uses existing `auth_sessions` columns (`ip_address`, `user_agent`, `last_active_at`, `revoked_at`, `refresh_token_hash`).

## Summary

| Change type | Detail                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| API         | `GET /auth/sessions` — list active sessions with device metadata          |
| API         | `DELETE /auth/sessions/:sessionId` — revoke one (`204`)                   |
| API         | `DELETE /auth/sessions` — revoke all except current                       |
| Service     | `DeviceInfoService` — local User-Agent parsing                            |
| Service     | `SessionActivityService` — Redis-throttled `lastActiveAt` updates         |
| Audit       | `auth.session.list`, `auth.sessions.revoked_all`, `auth.session.activity` |
| Config      | `SESSION_ACTIVITY_THROTTLE_SECONDS` (default 60)                          |

## Verification checklist (S1-C7)

- [ ] Session list returns newest first with `current` flag
- [ ] Single revoke requires ownership; rejects already-revoked
- [ ] Revoke-all preserves current session / access token
- [ ] Logout revokes current session and clears refresh hash
- [ ] JWT guard rejects revoked/expired sessions and inactive users
- [ ] `lastActiveAt` updates at most once per 60s per session
