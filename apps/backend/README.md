# @dripplex/backend

NestJS API for the Dripplex Super Platform.

## Stack

- NestJS 11 + TypeScript (strict)
- Prisma + PostgreSQL
- Redis (OTP + refresh-token revocation)
- JWT + OTP + RBAC (`User`, `Role`, `Permission`)
- Pino logging, throttling, global validation/exception/logging

## Endpoints (Commit 2)

| Method   | Path                       | Auth                 |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/api/v1/health`           | Public               |
| `POST`   | `/api/v1/auth/register`    | Public               |
| `POST`   | `/api/v1/auth/login`       | Public               |
| `POST`   | `/api/v1/auth/otp/request` | Public               |
| `POST`   | `/api/v1/auth/otp/verify`  | Public               |
| `POST`   | `/api/v1/auth/refresh`     | Public               |
| `POST`   | `/api/v1/auth/logout`      | Public               |
| `GET`    | `/api/v1/auth/me`          | JWT                  |
| `GET`    | `/api/v1/users`            | JWT + `users:read`   |
| `GET`    | `/api/v1/users/:id`        | JWT + `users:read`   |
| `DELETE` | `/api/v1/users/:id`        | JWT + `users:delete` |

## Local development

```bash
# from repo root
cp .env.example .env
pnpm install
pnpm --filter @dripplex/backend prisma:generate
pnpm --filter @dripplex/backend prisma:migrate:dev
pnpm --filter @dripplex/backend dev
```

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
