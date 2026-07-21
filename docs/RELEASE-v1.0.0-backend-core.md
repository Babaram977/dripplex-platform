# Release: v1.0.0-backend-core

**Date:** 2026-07-21  
**PR:** [#20](https://github.com/Babaram977/dripplex-platform/pull/20) (includes stabilization from [#21](https://github.com/Babaram977/dripplex-platform/pull/21))  
**Milestone:** Backend Core — complete marketplace engine (identity → fulfillment → platform supporting systems)

## Quality gates (release candidate)

| Gate            | Scope                               | Result            |
| --------------- | ----------------------------------- | ----------------- |
| lint            | `@dripplex/backend`, `types`, `sdk` | ✅                |
| typecheck       | `@dripplex/backend`, `types`, `sdk` | ✅                |
| test            | Backend Jest                        | ✅ **607** passed |
| build           | Backend Nest + types + sdk          | ✅                |
| prisma validate | Schema                              | ✅                |

> Note: monorepo-wide `pnpm lint` / `pnpm typecheck` still fail on **pre-existing** `@dripplex/customer-web` `confirmPassword` errors present on `main`. That app is **unchanged** by this release and is out of the Backend Core freeze scope.

## PR #21 review (Critical / High)

| Item                                              | Status  |
| ------------------------------------------------- | ------- |
| Promo redeem server-side discounts + atomic usage | ✅      |
| Fraud observational (`blocked` always false)      | ✅      |
| Duplicate payment-success notifications removed   | ✅      |
| Review aggregates = APPROVED only                 | ✅      |
| Wallet admin audit + ledger idempotency           | ✅      |
| SDK / OpenAPI synced                              | ✅      |
| Non-blocking event bus                            | ✅      |
| Template XSS escape                               | ✅      |
| Unintended auth/checkout/payment/delivery edits   | ✅ none |

## Smoke test status

Full interactive E2E against live Postgres/Redis/payment providers was **not available** in the release agent environment.

| Area                                                     | Coverage used for this release                               |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Customer auth / cart / checkout / payment / delivery     | Existing automated suites (pre-platform + platform emitters) |
| Notifications / search / reviews / wishlist / promotions | Unit + contract specs; stabilization contract tests          |
| Loyalty / wallet / analytics / CMS / fraud               | Unit specs + event subscriber specs                          |
| Event fan-out isolation                                  | `DomainEventBus` specs (handler failure isolation + `drain`) |

**Staging/manual smoke checklist** (run before production traffic):

### Customer

- [ ] Register → verify → login
- [ ] Search → wishlist → review
- [ ] Cart → checkout → payment → order
- [ ] Delivery tracking
- [ ] Notification received
- [ ] Loyalty points / wallet ledger

### Merchant

- [ ] Onboarding / KYC / approval
- [ ] Promotion create
- [ ] Analytics overview
- [ ] Review reply

### Rider

- [ ] Accept → location → complete delivery

### Admin

- [ ] CMS publish
- [ ] Fraud queue review
- [ ] Broadcast notification
- [ ] Wallet credit/debit (idempotent)
- [ ] Analytics / promotions

## Feature freeze (Backend Core)

Until Program B/C/D kickoff, treat as frozen unless bugfix:

- Authentication / sessions
- Checkout / orders
- Payments
- Delivery / fulfillment

Allowed: documentation, ops, non-core bugfixes, frontend/mobile/infra programs.

## Programs going forward

| Program | Focus                                                                                       |
| ------- | ------------------------------------------------------------------------------------------- |
| **A**   | Backend Core — **completed** (this tag)                                                     |
| **B**   | Frontend Platform — **FPX** series ([FPX-001](./FPX-001-frontend-platform-architecture.md)) |
| **C**   | Mobile Apps (Customer, Rider, Driver)                                                       |
| **D**   | Production Infrastructure (Docker, K8s, CI/CD, monitoring)                                  |
| **E**   | AI & Automation                                                                             |

## Apply migrations

```bash
pnpm --filter @dripplex/backend prisma:migrate:deploy
pnpm --filter @dripplex/backend prisma:seed
```

Migrations included:

- `20260721210000_s1_c14_c23_platform_supporting_systems`
- `20260721220000_s1_c14_c23_stabilization`
