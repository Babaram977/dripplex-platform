# DrippleX Identity Database (Prisma)

Sprint 1 database layer for identity and authentication per [DPX-013](../../docs/DPX-013.md).

## Layout

```text
prisma/
├── schema.prisma              # Source of truth
├── seed.ts                    # Idempotent roles + permissions seed
├── seed-data/
│   ├── permissions.ts         # Permission catalog (DPX-013 §5.3)
│   ├── roles.ts               # System roles (DPX-013 §5.1)
│   └── role-permissions.ts    # Role → permission grants
├── migrations/                # Versioned SQL migrations
├── SCHEMA.md                  # Model reference
├── MIGRATIONS.md              # Migration and rollback notes
└── ER-DIAGRAM.md              # Entity relationship diagram
```

## Commands

```bash
# From repository root
pnpm --filter @dripplex/backend prisma:validate
pnpm --filter @dripplex/backend prisma:generate
pnpm --filter @dripplex/backend prisma:migrate:dev
pnpm --filter @dripplex/backend prisma:migrate:deploy
pnpm --filter @dripplex/backend prisma:seed
```

Requires PostgreSQL (`DATABASE_URL` in `.env`). Start infrastructure services:

```bash
docker compose up -d postgres
```

## S1-C1 scope

| In scope (S1-C1)                                          | Deferred (S1-C2+)                 |
| --------------------------------------------------------- | --------------------------------- |
| `User` extensions                                         | `PasswordResetToken`              |
| `AuthSession`                                             | `UserDevice`, `Address`           |
| Profile stubs (`Customer`, `Merchant`, `Rider`, `Driver`) | Onboarding business detail fields |
| `RegistrationChannel`, `UserStatus.BLOCKED`               | Demo / bootstrap users            |
| Roles + permissions seed                                  |                                   |

## S1-C2 scope

| In scope (S1-C2)                                                       | Deferred (S1-C3+)         |
| ---------------------------------------------------------------------- | ------------------------- |
| `AuditLog`                                                             | `PasswordResetToken`      |
| `OnboardingStatus` enum                                                | Full onboarding workflows |
| `merchant_onboarding`, `rider_onboarding`, `driver_onboarding` (DRAFT) | Session token rotation    |
| Registration + verification API (no JWT on register/verify)            | Refresh token rotation    |

## S1-C3 scope

| In scope (S1-C3)                                | Deferred (S1-C4+)           |
| ----------------------------------------------- | --------------------------- |
| Portal login endpoints (`/auth/login/{portal}`) | Refresh token rotation      |
| `AuthSession` rows with null `refreshTokenHash` | Logout / session revocation |
| Login brute-force tracking (Redis)              | JWT issuance on login       |
| `users.last_active_at`, session `portal` column | Device management           |
| Audit login/session events                      | Password reset              |

## Seed policy

The seed script inserts **system roles and permissions only**. It does **not** create demo users. Production bootstrap administrators are created through a controlled process in a later commit.

Re-running `prisma db seed` is safe: all inserts use `upsert`.
