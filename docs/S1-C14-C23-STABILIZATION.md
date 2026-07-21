# S1-C14→C23 Stabilization (PR #21)

Resolves **Critical** and **High** findings from the Staff Engineer review of PR #20.
No new features. Backward compatible. Additive migrations only.

Base: `cursor/s1-c14-c23-platform-supporting-systems-1b33`  
Branch: `cursor/s1-c14-c23-stabilization-1b33`

---

## Review resolution table

### Critical

| #   | Finding                                                                              | Resolution                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Promotion redemption trusted client `amountSaved`; weak status/schedule/usage checks | Server calculates discount from order subtotal + promotion rules. `amountSaved` removed from `RedeemPromotionDto`. Requires `orderId`; verifies order ownership; validates ACTIVE + schedule + merchant + min order; row lock (`SELECT FOR UPDATE`) + serializable transaction; rejects duplicate order+promo redemption; atomic usage/per-user limits. |
| 2   | Fraud claimed `blocked` but never enforced on checkout/payment                       | **Observational mode** documented. `FraudService.evaluateOrderRisk` always returns `blocked: false` (blacklist still scores CRITICAL and writes signals). Types/docs note enforcement is deferred. Checkout/payment behavior unchanged.                                                                                                                 |

### High

| #   | Finding                                                                      | Resolution                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Duplicate payment-success notifications (`PAYMENT_SUCCEEDED` + `ORDER_PAID`) | Notification center maps only `ORDER_PAID` → `PAYMENT_SUCCESS`.                                                                                                                                                                   |
| 4   | Pending reviews updated rating aggregates                                    | Aggregates include **APPROVED** reviews only; create leaves `PENDING` without aggregate refresh; moderation recalculates.                                                                                                         |
| 5   | Admin wallet audit attributed to owner; no ledger idempotency                | Admin mutations use `@CurrentUser()` as audit actor; owner kept in metadata. Idempotent skip when `referenceType`+`referenceId` already exist. Additive unique partial index migration `20260721220000_s1_c14_c23_stabilization`. |
| 6   | SDK out of sync with backend                                                 | SDK + `@dripplex/types` aligned to controllers (notifications methods/paths, `/customer/wishlists`, authenticated search query params, `GET /reviews?targetType&targetId`, promo redeem body, wallet admin).                      |
| 7   | Event bus awaited handlers sequentially on hot paths                         | `DomainEventBus.emit` schedules handlers via background `Promise.allSettled` (non-blocking). `drain()` for tests.                                                                                                                 |
| 8   | Template variables not HTML-escaped                                          | `escapeHtml` on interpolated notification template values.                                                                                                                                                                        |
| —   | OpenAPI missing                                                              | Added `apps/backend/openapi/platform-supporting-systems.openapi.yaml` as interim contract (Swagger module deferred).                                                                                                              |

### Medium (deferred to next iteration — documented, not fixed here)

| Finding                                                                   | Follow-up                                   |
| ------------------------------------------------------------------------- | ------------------------------------------- |
| Missing domain event emissions (`ORDER_CREATED`, `PRODUCT_CREATED`, etc.) | Emit at mutation points or trim subscribers |
| Subscriber `onModuleDestroy` cleanup (most modules)                       | Unregister handlers                         |
| Analytics upsert / nullable `scopeId` unique race                         | Atomic upsert + non-null sentinel           |
| Wishlist price-drop / back-in-stock notifications incomplete              | Wire emits + notification center            |
| CMS scheduled publish has no job                                          | Scheduler / cron                            |
| Broadcast batching / dedupe / caps                                        | Cap `userIds`, dedupe                       |
| Search FTS/trigram indexes                                                | Performance iteration                       |
| Full `@nestjs/swagger` bootstrap                                          | After OpenAPI YAML validated                |

---

## Migrations

| Migration                                               | Purpose                                        |
| ------------------------------------------------------- | ---------------------------------------------- |
| `20260721210000_s1_c14_c23_platform_supporting_systems` | Platform tables/enums (PR #20)                 |
| `20260721220000_s1_c14_c23_stabilization`               | Wallet ledger idempotency unique partial index |

## Quality gates (stabilization)

- Backend tests: **600+** target
- lint / typecheck / build must pass
- No breaking API removals (fraud `blocked` field retained, always `false`)

## Suggested merge workflow

1. Review & merge this stabilization PR into the platform branch (or merge combined stack to `main`).
2. Re-run full automated suite.
3. Manual smoke tests (customer / merchant / rider / admin / event fan-out).
4. Merge platform supporting systems to `main`.
5. Continue S1-C24+.
