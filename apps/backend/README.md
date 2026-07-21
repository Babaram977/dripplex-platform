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
