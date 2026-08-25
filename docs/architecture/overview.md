# DrippleX Architecture Overview

## Vision

DrippleX is a Nigerian Super Platform: marketplace, food delivery, parcel delivery, ride hailing, pharmacy, home services, wallet, and operator portals. The architecture must support millions of users and geographic expansion across Africa without rewriting core bounded contexts.

## Style

- **Monorepo** (Turborepo + pnpm) for atomic cross-cutting changes.
- **Clean Architecture** with NestJS modules as application boundaries.
- **Domain-Driven Design** for Orders, Wallet, Dispatch, Ride, and Delivery.
- **Repository pattern** over Prisma for persistence isolation.
- **Shared packages** (`@dripplex/ui`, `types`, `sdk`, `hooks`, `utils`, `config`) eliminate duplication across portals.

## Runtime topology

```text
                    ┌─────────────────────────┐
                    │     API Gateway / LB      │
                    └────────────┬──────────────┘
                                 │  /api/v1
                    ┌────────────▼──────────────┐
                    │   NestJS Backend          │
                    │   Auth · Domain Modules   │
                    │   Socket.IO gateways      │
                    └─────┬──────────────┬──────┘
                          │              │
                 ┌────────▼───┐   ┌──────▼──────┐
                 │ PostgreSQL │   │    Redis    │
                 └────────────┘   └─────────────┘

  Next.js portals (customer, merchant, rider, driver, ops, admin)
           └── consume @dripplex/sdk + @dripplex/ui
```

## Backend modules (bounded contexts)

| Module                                               | Responsibility                   |
| ---------------------------------------------------- | -------------------------------- |
| Auth                                                 | JWT, OTP, sessions, RBAC         |
| Users                                                | Identity profiles and roles      |
| Merchant / Store / Products / Categories / Inventory | Merchant catalog                 |
| Orders                                               | Order lifecycle across verticals |
| Wallet / Payments                                    | Ledger, funding, settlements     |
| Dispatch / Delivery / Ride                           | Matching and fulfillment         |
| Notifications / Messaging                            | Push, SMS, in-app, real-time     |
| Reviews                                              | Ratings and reputation           |
| Analytics                                            | Aggregates and reporting feeds   |
| Operations / Admin                                   | Operator tooling and governance  |

Every module ships with Controller, Service, DTOs, validation, Nest module wiring, and tests.

## Data rules

- UUID primary keys
- Soft delete via `deletedAt`
- Audit timestamps: `createdAt`, `updatedAt`, `deletedAt`
- Prisma as the sole ORM for PostgreSQL

## Frontend rules

Each Next.js 15 app uses App Router, TypeScript, Tailwind, shadcn/ui (via `@dripplex/ui`), auth layout, dashboard layout, loading/error/404 pages, responsive layout, and dark mode.

## API rules

- Versioned REST under `/api/v1/`
- DTO validation on every write path
- Consistent error envelope (code, message, details, correlationId)
- Rate limiting on sensitive routes

## Security

- Strict TypeScript (`noImplicitAny`, ban `any`)
- Password hashing (KDF)
- Environment-based secrets
- RBAC on routes and UI
- Never hardcode credentials

## Incremental delivery

| Commit | Scope                                                                     | Status  |
| ------ | ------------------------------------------------------------------------- | ------- |
| 1      | Workspace, tooling, docs, `@dripplex/config`                              | Done    |
| 2      | Backend NestJS + Prisma (`User`/`Role`/`Permission`), Redis, Auth, Health | Done    |
| 3      | Customer web foundation (layouts, auth UI, dashboard shell)               | Done    |
| 4      | Shared packages (`ui`, `sdk`, `types`, `hooks`, `utils`)                  | Done    |
| 5      | Docker Compose, GitHub Actions                                            | Pending |

Subsequent vertical portals reuse packages from Commits 3–4.

## Specifications

| ID      | Title                                | Document                    |
| ------- | ------------------------------------ | --------------------------- |
| DPX-013 | Identity & Authentication (Sprint 1) | [DPX-013.md](../DPX-013.md) |
