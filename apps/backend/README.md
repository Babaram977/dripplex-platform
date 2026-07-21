# @dripplex/backend

NestJS API for the Dripplex Super Platform.

## Stack

- NestJS 11 + TypeScript (strict)
- Prisma + PostgreSQL
- Redis (OTP + login brute-force protection only)
- JWT (session-bound access + refresh) + OTP + RBAC (`User`, `Role`, `Permission`)
- Pino logging, throttling, global validation/exception/logging

## Endpoints

### Sprint 0.1 (legacy scaffold)

| Method   | Path                       | Auth                 |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/api/v1/health`           | Public               |
| `POST`   | `/api/v1/auth/register`    | Public (deprecated)  |
| `POST`   | `/api/v1/auth/otp/request` | Public               |
| `POST`   | `/api/v1/auth/otp/verify`  | Public               |
| `GET`    | `/api/v1/users`            | JWT + `users:read`   |
| `GET`    | `/api/v1/users/:id`        | JWT + `users:read`   |
| `DELETE` | `/api/v1/users/:id`        | JWT + `users:delete` |

### S1-C2 — Registration & verification

| Method | Path                             | Auth   | Notes                           |
| ------ | -------------------------------- | ------ | ------------------------------- |
| `POST` | `/api/v1/auth/register/customer` | Public | No JWT returned                 |
| `POST` | `/api/v1/auth/register/merchant` | Public | Initializes merchant onboarding |
| `POST` | `/api/v1/auth/register/rider`    | Public | Phone required                  |
| `POST` | `/api/v1/auth/register/driver`   | Public | Phone required                  |
| `POST` | `/api/v1/auth/verify/email`      | Public | Updates `emailVerifiedAt`       |
| `POST` | `/api/v1/auth/verify/phone`      | Public | Updates `phoneVerifiedAt`       |

### S1-C3 — Login & sessions

| Method | Path                          | Auth   | Notes                             |
| ------ | ----------------------------- | ------ | --------------------------------- |
| `POST` | `/api/v1/auth/login/customer` | Public | Portal login + session + JWT (C4) |
| `POST` | `/api/v1/auth/login/merchant` | Public | Portal role enforced + JWT (C4)   |
| `POST` | `/api/v1/auth/login/rider`    | Public | Phone/email login + JWT (C4)      |
| `POST` | `/api/v1/auth/login/driver`   | Public | Phone/email login + JWT (C4)      |

### S1-C4 — JWT, refresh & session rotation

| Method | Path                      | Auth   | Notes                         |
| ------ | ------------------------- | ------ | ----------------------------- |
| `POST` | `/api/v1/auth/refresh`    | Public | Refresh token rotation (body) |
| `POST` | `/api/v1/auth/logout`     | JWT    | Revokes current session       |
| `POST` | `/api/v1/auth/logout-all` | JWT    | Revokes all user sessions     |
| `GET`  | `/api/v1/auth/me`         | JWT    | Session-validated profile     |

### S1-C5 — Password management

| Method | Path                           | Auth   | Notes                                  |
| ------ | ------------------------------ | ------ | -------------------------------------- |
| `POST` | `/api/v1/auth/password/forgot` | Public | Anti-enumeration; rate limited 5/hour  |
| `POST` | `/api/v1/auth/password/reset`  | Public | Token + OTP; revokes all sessions      |
| `POST` | `/api/v1/auth/password/change` | JWT    | Verifies current password; revokes all |

**Password policy (DPX-013 §3.1):** 8–128 chars; at least one uppercase, lowercase, and digit; rejects a local common-password denylist.

Reset tokens are opaque UUIDs/hex values stored as SHA-256 hashes in `password_reset_tokens`. Notifications go through `NotificationService` (logging stub until email provider wiring).

### S1-C6 — Identity verification

| Method | Path                                   | Auth   | Notes                                        |
| ------ | -------------------------------------- | ------ | -------------------------------------------- |
| `POST` | `/api/v1/auth/email/send-verification` | Public | HMAC-signed token; anti-enumeration          |
| `POST` | `/api/v1/auth/email/verify`            | Public | One-time signed token                        |
| `POST` | `/api/v1/auth/email/resend`            | Public | Invalidates prior email challenge            |
| `POST` | `/api/v1/auth/phone/send-otp`          | Public | 6-digit OTP; SHA-256 in DB; anti-enumeration |
| `POST` | `/api/v1/auth/phone/verify`            | Public | Attempt limits + lockout                     |
| `POST` | `/api/v1/auth/phone/resend`            | Public | Invalidates prior phone OTP                  |

Challenges are stored in `identity_verifications` (hash-only). Redis is used only for hourly rate limits, resend cooldown, and phone OTP lockout. Legacy registration OTP verify endpoints (`/auth/verify/email|phone`) remain for S1-C2 compatibility.

### S1-C7 — Device management & session dashboard

| Method   | Path                               | Auth                         | Notes                               |
| -------- | ---------------------------------- | ---------------------------- | ----------------------------------- |
| `GET`    | `/api/v1/auth/sessions`            | JWT + `auth:sessions:read`   | List active sessions (newest first) |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | JWT + `auth:sessions:revoke` | Revoke one session; `204`           |
| `DELETE` | `/api/v1/auth/sessions`            | JWT + `auth:sessions:revoke` | Revoke all except current           |
| `POST`   | `/api/v1/auth/logout`              | JWT                          | Revokes current session             |

Device metadata (`browser`, `os`, `device`, `deviceType`) is parsed from `User-Agent` (no external APIs). `location` is always `null` in this sprint. Session `lastActiveAt` updates are throttled via Redis (`session:last-active:{sid}`, 60s).

**JWT access payload** (no permissions in token):

```json
{
  "sub": "<user-uuid>",
  "sid": "<auth-session-uuid>",
  "role": "customer",
  "portal": "customer",
  "typ": "access",
  "iat": 1720000000,
  "exp": 1720000900
}
```

Permissions are loaded from the database on each authenticated request. Refresh state is stored as `SHA-256(refreshToken)` in `auth_sessions.refresh_token_hash` — not in Redis.

**Removed in S1-C4:** `POST /api/v1/auth/login` (legacy Sprint 0.1 login).

See [DPX-013](../docs/DPX-013.md) for full Sprint 1 contracts.

## Local development

```bash
# from repo root
cp .env.example .env
pnpm install
pnpm --filter @dripplex/backend prisma:generate
pnpm --filter @dripplex/backend prisma:migrate:dev
pnpm --filter @dripplex/backend prisma:seed
pnpm --filter @dripplex/backend dev
```

Identity schema, migrations, and seed documentation: [prisma/README.md](prisma/README.md) (Sprint 1 / DPX-013).

## Quality gates

```bash
pnpm --filter @dripplex/backend lint
pnpm --filter @dripplex/backend typecheck
pnpm --filter @dripplex/backend test
pnpm --filter @dripplex/backend build
```

## Docker

```bash
docker build -f apps/backend/Dockerfile -t dripplex-backend .
```

### S1-C8 — Merchant & business onboarding

| Method  | Path                                        | Auth                               | Notes                        |
| ------- | ------------------------------------------- | ---------------------------------- | ---------------------------- |
| `POST`  | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Create business (submitted)  |
| `GET`   | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Own business profile         |
| `PATCH` | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Update editable fields       |
| `POST`  | `/api/v1/merchant/kyc`                      | JWT + `merchant:kyc:manage`        | Submit KYC documents         |
| `GET`   | `/api/v1/merchant/kyc`                      | JWT + `merchant:kyc:manage`        | KYC status                   |
| `POST`  | `/api/v1/merchant/bank-account`             | JWT + `merchant:bank:manage`       | Add bank account             |
| `GET`   | `/api/v1/merchant/bank-account`             | JWT + `merchant:bank:manage`       | List bank accounts           |
| `PATCH` | `/api/v1/merchant/bank-account/:id/default` | JWT + `merchant:bank:manage`       | Set default                  |
| `GET`   | `/api/v1/admin/merchants`                   | JWT + `admin:merchants:review`     | Filter + paginate            |
| `GET`   | `/api/v1/admin/merchant/:id`                | JWT + `admin:merchants:review`     | Full profile + audit summary |
| `POST`  | `/api/v1/admin/merchant/:id/approve`        | JWT + `admin:merchants:approve`    | Requires verified KYC        |
| `POST`  | `/api/v1/admin/merchant/:id/reject`         | JWT + `admin:merchants:reject`     | Reason required              |
| `POST`  | `/api/v1/admin/merchant/:id/suspend`        | JWT + `admin:merchants:suspend`    | Suspend approved merchant    |
| `POST`  | `/api/v1/admin/merchant/:id/reactivate`     | JWT + `admin:merchants:reactivate` | Restore suspended merchant   |

#### Merchant onboarding flow

1. Register via `/auth/register/merchant` and verify email + phone (S1-C6).
2. `POST /merchant/business` — creates business, sets merchant `UNDER_REVIEW`.
3. `POST /merchant/kyc` — submit identity/business documents.
4. Optionally add bank accounts via `/merchant/bank-account`.
5. Admin verifies KYC, then `POST /admin/merchant/:id/approve`.
