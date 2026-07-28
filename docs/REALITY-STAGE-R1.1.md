# Reality Stage R1.1 — Product Catalog Foundation

**Date:** 2026-07-28
**Branch:** `claude/dripplex-coolify-deploy-fatig4`
**Commit:** `a562d2e`
**Status:** Backend + schema complete, tested, and pushed. **Not yet applied to Railway** (see Deployment status below) — this session had no Railway tool access.

## Why

The Implementation Audit (`docs/AUDIT-IMPLEMENTATION.md`) found the single largest gap in the platform: no `Product` model existed anywhere. `CartItem`/`OrderItem` carried a bare `productId: String @db.Uuid` with no foreign key, no backing table, and no server-side validation — a client could add anything to a cart, including a product that never existed, and checkout would accept it. This blocked the Customer Marketplace and Merchant Center modules, which have nothing real to sell without it. R1.1 closes that gap at the schema and backend-validation layer, without building any merchant/customer-facing catalog API or frontend (that's R1.2/R1.3/R1.4/R1.5).

## Schema changes

Added to `apps/backend/prisma/schema.prisma`:

- `enum ProductStatus { DRAFT, PUBLISHED, ARCHIVED }`
- `Category` — self-referencing hierarchy (`parentId`), unique `slug`
- `Brand` — unique `slug`
- `Product` — belongs to `MerchantProfile` (cascade delete), optional `Category`/`Brand`, `basePrice`/`currency`, `status`, `isDeleted` (soft delete), unique on `(merchantId, slug)`
- `ProductImage` — belongs to `Product` (cascade delete), ordered by `position`
- `ProductVariant` — belongs to `Product` (cascade delete), optional `priceOverride`
- `ProductInventory` — one-to-one with `Product` (cascade delete), `quantity`/`reserved`/`trackInventory`

`CartItem` and `OrderItem` already had `productId`/`variantId` columns (part of the existing "snapshot" pattern — cart/order items store an immutable name/sku/image/price snapshot at add-time, independent of the live catalog). This milestone added the missing relations:

```prisma
product Product         @relation(fields: [productId], references: [id], onDelete: Restrict)
variant ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
```

`onDelete: Restrict` on `product` means a `Product` with existing cart/order history can't be hard-deleted — only soft-deleted via `isDeleted`, which is the intended lifecycle (order history must survive product removal).

## Migration

`apps/backend/prisma/migrations/20260728015436_add_product_catalog/migration.sql` — additive only: creates the six new tables/indexes and adds the two new foreign keys on `cart_items`/`order_items`. Nothing existing is altered or dropped.

**Data-safety decision (documented in the migration file itself):** adding `cart_items_product_id_fkey`/`order_items_product_id_fkey` requires every existing row's `product_id` to match a real `products` row. Since `products` never existed before this migration, any pre-existing `cart_items`/`order_items` row is *necessarily* a dangling reference (the API accepted an arbitrary client-supplied UUID with zero validation) — there is no legitimate catalog-backed row that could exist to lose. The migration removes such orphaned rows (a `DO $$ ... RAISE NOTICE` block reports the count) immediately before adding the constraint. This is a no-op when the tables are empty, which — per the audit — is the expected state (no cart/checkout frontend has ever existed, so no real customer has ever added anything to a cart).

**Scope discipline:** while generating the migration, `prisma migrate diff` surfaced pre-existing drift between `schema.prisma` and the applied migration history that predates this session and is unrelated to the catalog: a missing unique constraint on `wallet_ledger_entries`, a missing index on `orders.order_number`, and two constraint-name mismatches on `analytics_daily_metrics`/`notification_delivery_attempts`. These were deliberately excluded from this migration so as not to bundle unrelated, unverified risk into a catalog deploy — **flagging this as a separate, pre-existing issue for a future migration**, not something introduced or fixed here.

### Verification method

Railway MCP tooling was not available in this session, so the migration could not be applied to the live Railway Postgres directly. Instead it was verified against a disposable local Postgres instance seeded with the exact same 14 migrations already confirmed applied to Railway (per this engagement's earlier deployment work):

1. Applied all 14 existing migrations fresh (`prisma migrate deploy`) — succeeded, matching Railway's known state.
2. Generated and applied the new migration (`prisma migrate deploy`) — succeeded cleanly.
3. `prisma migrate status` — "Database schema is up to date."
4. Confirmed real constraint enforcement (not just successful apply): unique `(merchantId, slug)`, FK rejection for a non-existent merchant, and cascade delete from `Product` to its images/variants/inventory — all covered by `prisma/prisma-product-catalog.spec.ts`.

## Backend wiring

The codebase already had two explicitly-labeled extension points awaiting a real catalog ("Catalog module will replace the stub implementation"). Both are now wired to real implementations backed by a new `ProductsService`:

| Extension point | Module | Was | Now |
|---|---|---|---|
| `CHECKOUT_PRODUCT_VALIDATOR` | `orders` | `StubCheckoutProductValidator` — always returned a fabricated snapshot, `active: true`, `deleted: false` for any UUID | `CatalogCheckoutProductValidator` — resolves real name/sku/image/price from `Product`/`ProductVariant`; unknown products are treated as deleted, unpublished products as inactive — both now correctly block checkout |
| `CHECKOUT_INVENTORY_VALIDATOR` | `orders` | `AlwaysAvailableCheckoutInventoryValidator` — no-op | `CatalogCheckoutInventoryValidator` — rejects checkout for products that don't exist, aren't published, or don't have enough tracked stock |
| `INVENTORY_VALIDATOR` | `cart` | `AlwaysAvailableInventoryValidator` — no-op | `CatalogInventoryValidator` — same checks, applied when adding/updating a cart item, plus a merchant-ownership check |

New: `apps/backend/src/products/products.module.ts` + `products.service.ts` — a `ProductsService` used by all three validators above, resolving product+variant+inventory by ID(s) into a single `ResolvedCatalogItem` shape. No public HTTP controller was added: there is nothing yet that can call one (no merchant create/update API — that's R1.2 — and no frontend), so building one now would mean throwaway surface area duplicating what R1.2 will build properly. `ProductsService` is exported from the module so R1.2/R1.3 can build directly on it instead of starting over.

The original stub classes (`StubCheckoutProductValidator`, `AlwaysAvailableCheckoutInventoryValidator`, `AlwaysAvailableInventoryValidator`) were left in place, untouched and still passing their own tests — only the module bindings (`useClass`) were changed to point at the new real implementations. Nothing was deleted.

**Deliberately not changed:** `CartService.addItem` still stores the client-supplied name/sku/image/price as the cart item's snapshot (consistent with the existing snapshot-pattern design elsewhere in the codebase — order line items also snapshot their own values independent of the live catalog). What changed is that adding an item for a product that doesn't exist, isn't published, or is out of stock is now rejected before that snapshot is ever written, instead of being silently accepted.

## Tests

- **Existing suite:** 91 suites / 607 tests — all still pass. One pre-existing environmental flake unrelated to this work was found and fixed in passing: `prisma/prisma-migration-seed.spec.ts`'s second test runs `prisma db seed` twice sequentially (~3s each via `ts-node`) against a 5000ms Jest default timeout, and was failing on both this branch and untouched `main` in this sandbox. Bumped its timeout to 20s (`prisma-migration-seed.spec.ts`); no behavioral change.
- **New:** 5 files / 24 tests —
  - `prisma/prisma-product-catalog.spec.ts` (5) — real-Postgres integration test: model registration, full relation graph (Category → Brand → Product → Variant/Image/Inventory), the `(merchantId, slug)` unique constraint, FK rejection for a nonexistent merchant, cascade delete.
  - `products/products.service.spec.ts` (7) — resolution logic: variant name/sku/price-override precedence, missing product, tracked vs. untracked stock, sellability by status.
  - `cart/inventory/catalog-inventory.validator.spec.ts` (5), `orders/pricing/catalog-checkout-product.validator.spec.ts` (3), `orders/inventory/catalog-checkout-inventory.validator.spec.ts` (4) — each validator's accept/reject branches.
- **Total: 96 suites / 631 tests, all green.** `pnpm lint` and `pnpm typecheck` both clean.

## Deployment status — action needed

This work is pushed to `claude/dripplex-coolify-deploy-fatig4` only, per this session's branch instructions. It has **not** been applied to Railway:

- This session had no Railway MCP tool access (checked at the start of this task and again just now — none registered), so the migration could not be triggered or confirmed against the live database directly.
- Railway's existing `preDeployCommand` (`node_modules/.bin/prisma migrate deploy`) will apply this migration automatically on the next deploy of whatever branch Railway is watching — but that requires this branch to reach that branch (merge to `main`, or however this repo's Railway service is configured), which is outside what this session did on its own authority.

**To finish R1.1's Definition of Done, someone needs to:** merge/promote this branch to whatever Railway deploys from, then confirm (a) the pre-deploy migration step reports the new migration applied and (b) `GET /health` (or `/api/v1/health`) still returns healthy afterward. I can do this in a follow-up turn if Railway tool access becomes available in this session, or if you'd like me to open a PR now.

## Deferred (by design, per your R1 roadmap)

- R1.2 — Merchant Catalog API: create/update/delete/publish products, image upload, inventory management
- R1.3 — Customer Catalog API: browse/search/detail endpoints
- R1.4 / R1.5 — Merchant and Customer Marketplace UI
- R1.6 — Reality Verification: live end-to-end demo (merchant creates product → customer discovers → adds to cart)
- No frontend changes were made, per this milestone's explicit constraint.
