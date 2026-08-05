# DPX-MERCHANT-012 — Merchant Phase 2 Security Review

## 1. Scope (Merchant Phase 2, per founder's locked sequencing)

Second step of the founder's locked module-completion sequence (E2E →
**security review** → production audit → founder review → freeze). Scope
as explicitly specified: Authorization, Merchant isolation, API exposure,
Permission checks, Input validation, Cross-merchant access attempts, Rate
limiting where applicable.

Method: static review of every `merchant/*` controller/service, followed
by a live cross-merchant attack simulation (`verify-merchant-security.
script.ts`, written, run, and deleted — same methodology as every prior
DPX-MERCHANT-00x pass) driving real HTTP requests against the real
backend with two independently-fixtured merchants.

## 2. Global security posture (applies to every route, not just merchant)

- **Authentication is default-deny.** `JwtAuthGuard` is a global
  `APP_GUARD`; every route requires a valid JWT unless explicitly marked
  `@Public()`. No `merchant/*` controller carries `@Public()`.
- **Authorization is opt-in per route, correctly used everywhere in
  scope.** `PermissionsGuard` (also a global `APP_GUARD`) allows a route
  through if it declares no `@RequirePermissions` — an intentional
  "permission checks are additive" design, not a default-allow gap in
  practice, because every one of the 8 merchant controllers
  (`merchant/analytics`, `merchant` [business/kyc/bank], `merchant/
notifications`, `merchant/settlements`, `merchant/orders`, `merchant/
products`, `merchant/reviews`, `merchant/wallet`) declares
  `@RequirePermissions` on every handler or at the controller level.
  Confirmed by grep across all 8 files — zero handlers without a
  permission decorator.
- **Input validation is global and strict.** `ValidationPipe({whitelist:
true, forbidNonWhitelisted: true, transform: true})` is a global
  `APP_PIPE` — any unrecognized field in a request body is rejected
  (400), not silently dropped or accepted.
- **Rate limiting is global.** `ThrottlerGuard` is a global `APP_GUARD`
  backed by `ThrottlerModule.forRootAsync`, default `THROTTLE_LIMIT=100`
  requests per `THROTTLE_TTL_MS=60_000`ms (env-configurable), applying to
  every route including all `merchant/*` controllers. Login endpoints
  additionally carry an explicit tighter `@Throttle({limit: 20, ttl:
60_000})` on top of the global default. Not brute-force load-tested here
  (would be slow/flaky against a shared dev server and doesn't change
  based on merchant-specific code); the wiring itself was code-confirmed.

## 3. Merchant isolation — code review

Every merchant-scoped mutation/read that takes a resource `:id` resolves
the caller's `MerchantProfile.id` from their JWT `user.id` first, then
filters the resource lookup by both the resource id **and** that
resolved profile/owner id, throwing `NotFoundDomainException` (404) — not
`ForbiddenDomainException` (403) — when the resource belongs to a
different merchant. This is the correct pattern (not leaking whether the
resource exists at all to a merchant who doesn't own it) and was found
applied consistently:

| Controller                                                                                                 | Guard mechanism                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merchant/orders/:id`, `:id/accept`, `:id/reject`, `:id/ready`, `:id/delay`, `:id/cancel`                  | `MerchantOrdersService.requireOrder()` — resolves `MerchantProfile.id`, `findByIdForMerchant(orderId, merchantProfileId)`                                                                                                                                                                                                        |
| `merchant/products/:id` (+ every sub-route: publish, unpublish, images, variants, inventory, stock-status) | `MerchantProductsService.requireOwnedProduct()` — `findFirst({id, merchantId, isDeleted:false})`; image/variant sub-ids are additionally checked against `owned.images`/`owned.variants` before the raw update/delete, so a foreign imageId/variantId (even one belonging to the merchant's own other product) can't be targeted |
| `merchant/bank-account/:id/default`                                                                        | `MerchantsService.setDefaultBankAccount()` — explicit `account?.merchantId !== merchantUserId` check                                                                                                                                                                                                                             |
| `merchant/reviews/:id/reply`                                                                               | `ReviewsService.replyAsMerchant()` — `assertMerchantCanReply(profile.id, review)`                                                                                                                                                                                                                                                |
| `merchant/notifications/:id` (read/delete)                                                                 | `NotificationCenterService.assertNotificationOwner()`                                                                                                                                                                                                                                                                            |
| `merchant/wallet`, `merchant/wallet/transactions`, `merchant/settlements`, `merchant/analytics/overview`   | No `:id` param — always scoped to the caller's own `user.id`/resolved `MerchantProfile.id`, no foreign-id injection surface exists                                                                                                                                                                                               |

This is the same `MerchantProfile.id` vs `User.id` resolution discipline
already fixed for Reviews (DPX-MERCHANT-008) and Analytics
(DPX-MERCHANT-010) — confirmed here to be applied correctly everywhere
else it's needed, with no further instances of that bug class found.

## 4. Live cross-merchant attack simulation

Two independently-fixtured merchants (A, B), each with their own
`MerchantProfile`, `Business`, `Product`, and `BankAccount`, plus a
customer who places a real order against merchant A's product — all
driven over real HTTP against the real backend (28 assertions, all
passed):

- **No auth**: `GET /merchant/products` with no token → `401`; with a
  garbage token → `401`.
- **Wrong role**: a customer-role JWT on `GET /merchant/products` → `403`
  (missing `merchant:products:manage`) — role-permission grants checked
  against `role-permissions.ts` confirm `merchant:*` permissions are
  granted only to the `merchant` role (plus `super_administrator`, an
  intentional omniscient role) — never to `customer`/`rider`/`driver`/
  `operations_staff`.
- **Cross-merchant product IDOR**: merchant A attempting `GET`, `POST
:id/publish`, and `DELETE` on merchant B's product → `404` on all three;
  merchant B's product confirmed still present and not deleted afterward.
- **Cross-merchant bank-account IDOR**: merchant A attempting `PATCH
:id/default` on merchant B's bank account → `404`.
- **List scoping**: merchant A's product list and bank-account list never
  contain merchant B's rows.
- **Cross-merchant order IDOR**: merchant B attempting `GET` and `PATCH
:id/accept` on merchant A's real order (created via real checkout) →
  `404` on both; the order confirmed still `PENDING` (untouched) and
  absent from merchant B's own order list afterward.
- **Input validation**: `POST /merchant/products` with an unrecognized
  field → `400`; with a non-numeric `basePrice` → `400`; `POST /customer/
reviews` with `rating: 99` (outside 1–5) → `400`; with an invalid
  `targetType` enum value → `400`.

## 5. What this review did not (re-)test

- **Review-reply IDOR** was verified by code review only
  (`assertMerchantCanReply`), not re-driven live in this pass — it uses
  the identical resolve-then-compare pattern already live-verified for
  products/orders/bank-accounts above, and was already the subject of a
  dedicated live IDOR-style fix in DPX-MERCHANT-008.
- **Analytics cross-merchant scoping** was already live-verified with a
  second real merchant's orders correctly excluded in DPX-MERCHANT-010 —
  not repeated here.
- **Rate-limit enforcement** (actually tripping the 100-req/min or
  20-req/min limiters) was not brute-force tested — the wiring was
  code-confirmed instead (see §2), consistent with not hammering a shared
  dev server for a limit that isn't merchant-specific code.
- **SQL/NoSQL injection**: not a distinct test — every merchant query goes
  through Prisma's parameterized query builder (no raw SQL string
  concatenation found in any merchant service), so this class of
  vulnerability isn't reachable from any endpoint reviewed here.

## 6. Findings

**None.** No authorization gap, cross-merchant data leak, or IDOR was
found in any merchant-facing endpoint. Every `:id`-based mutation and
read correctly scopes to the calling merchant's own resources and returns
`404` (not silently succeeding, not `403`-leaking existence) for another
merchant's resource. This is a clean result, not a rubber stamp — it was
tested adversarially with two real, independent merchant accounts
attempting to read and mutate each other's data across four different
resource types (products, orders, bank accounts, and their list views).

## 7. Next step

Proceed to **#391 — production audit** (Module completeness, SDK
coverage, Merchant Portal coverage, Documentation, Performance, Error
handling, Production readiness), per the founder's locked sequence, then
Founder Review and Freeze Merchant Module.
