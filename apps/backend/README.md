# @dripplex/backend

NestJS API for the Dripplex Super Platform.

## Stack

- NestJS 11 + TypeScript (strict)
- Prisma + PostgreSQL
- Redis (OTP + refresh-token revocation)
- JWT + OTP + RBAC (`User`, `Role`, `Permission`)
- Pino logging, throttling, global validation/exception/logging

## Endpoints

### Sprint 0.1 (legacy scaffold)

| Method   | Path                       | Auth                 |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/api/v1/health`           | Public               |
| `POST`   | `/api/v1/auth/register`    | Public (deprecated)  |
| `POST`   | `/api/v1/auth/login`       | Public               |
| `POST`   | `/api/v1/auth/otp/request` | Public               |
| `POST`   | `/api/v1/auth/otp/verify`  | Public               |
| `POST`   | `/api/v1/auth/refresh`     | Public               |
| `POST`   | `/api/v1/auth/logout`      | Public               |
| `GET`    | `/api/v1/auth/me`          | JWT                  |
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

| Method | Path                          | Auth   | Notes                        |
| ------ | ----------------------------- | ------ | ---------------------------- |
| `POST` | `/api/v1/auth/login/customer` | Public | Session created; no JWT      |
| `POST` | `/api/v1/auth/login/merchant` | Public | Portal role enforced; no JWT |
| `POST` | `/api/v1/auth/login/rider`    | Public | Phone/email login; no JWT    |
| `POST` | `/api/v1/auth/login/driver`   | Public | Phone/email login; no JWT    |

Login returns user profile, permissions, and `AuthSession` metadata (`refreshTokenHash` null until S1-C4).

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
