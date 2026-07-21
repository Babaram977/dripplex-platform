# Dripplex Identity Database (Prisma)

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

| In scope (S1-C1)                                          | Deferred (S1-C2+)                  |
| --------------------------------------------------------- | ---------------------------------- |
| `User` extensions                                         | `AuditLog`                         |
| `AuthSession`                                             | `PasswordResetToken`               |
| Profile stubs (`Customer`, `Merchant`, `Rider`, `Driver`) | Onboarding detail tables           |
| `RegistrationChannel`, `UserStatus.BLOCKED`               | `OnboardingStatus` workflow tables |
| Roles + permissions seed                                  | Demo / bootstrap users             |

## Seed policy

The seed script inserts **system roles and permissions only**. It does **not** create demo users. Production bootstrap administrators are created through a controlled process in a later commit.

Re-running `prisma db seed` is safe: all inserts use `upsert`.
