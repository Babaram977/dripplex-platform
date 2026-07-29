# Reality Stage R1.3 — Customer Marketplace API — Design Handoff Package

**Date:** 2026-07-28
**Branch:** `claude/dripplex-coolify-deploy-fatig4`
**Commit:** `d377d93`
**Status:** Backend complete, tested, pushed. **Not yet applied to Railway** — same standing caveat as R1.1/R1.2: this session has no Railway tool access, so nothing here is live until this branch reaches whatever branch Railway deploys from.

This is the first "Design Handoff Package" under the new rule: every completed engineering milestone ends with one of these, so the DDS branch never has to guess a payload shape.

---

## 1. Summary

R1.3 is the first customer-facing (public, unauthenticated) layer of the catalog: browse/filter/sort, four curated presets (featured, new arrivals, trending, recommended), product detail, similar products, and category/brand listings. Everything is read-only and scoped to `PUBLISHED`, non-deleted products only — a draft or archived product is invisible here no matter what filter is used.

Two architectural decisions worth knowing before designing screens against this:

- **Two pre-existing subsystems were wired in rather than duplicated.** The codebase already had a generic search index (`SearchDocument`) and a subscriber listening for `PRODUCT_CREATED`/`INVENTORY_CHANGED` events that nothing had ever emitted (Product didn't exist until R1.1). R1.3 wires `MerchantProductsService`'s writes to emit those events, so that index is now live. It also already had a `ReviewAggregate` model anticipating a `PRODUCT` target type — R1.3 reads ratings from it. Reviews themselves (writing a review) aren't built yet; rating will read `0`/no reviews for every product until that milestone lands.
- **"Recommended" and "Trending" are honest heuristics, not AI.** Per your own instruction to leave AI search for a later stage, and because the audit confirmed no recommendation engine exists: *Trending* = units ordered in the last 30 days (real `OrderItem` data — will show empty results until real orders happen), *Recommended* = highest average rating (same heuristic as "best rated" sort). Both are clearly labelled as such below so this doesn't read as more sophisticated than it is.

## 2. What Nora needs to know before designing screens

- **Empty states are the default state right now.** No product has ever been ordered or reviewed in production (per the R1 audit), so Trending, Recommended, and rating badges will render as empty/zero for real users until R1.2's merchant UI (R1.4) and real orders exist. Design the empty state, not just the populated one.
- **Pagination is cursor-based, not page-numbered.** Every list response has `nextCursor` (string or `null`) and `hasMore` (boolean) — no total count, no page numbers. This fits infinite-scroll/"load more" patterns, not numbered pagination controls.
- **List items are lightweight (`ProductSummaryDto`); detail is heavier (`ProductDetailDto`).** Browse/search/preset endpoints return summaries (one image, no variant list, no description) — don't design list cards that need full variant data.
- **Distance/location filtering is accepted but inert.** `lat`/`lng` query params exist on the browse endpoint for forward compatibility but do nothing yet — don't design a "sort by distance" control that will silently no-op.

## 3. API Contract

Base path: none of these are prefixed beyond the global API prefix (`/api/v1` in production). All are `@Public()` — no `Authorization` header required, no permission checks. All return the platform's standard envelope: `{ "success": true, "data": ... }` on success, or the platform's standard error envelope (see §6) on failure.

### `GET /products` — Browse / filter / sort / search

The one endpoint every other list endpoint below is a preset of.

| | |
|---|---|
| **Auth** | None (`@Public()`) |
| **Query params** | see table below |
| **Response** | `200` → `ApiSuccessResponse<CursorPaginatedResult<ProductSummaryDto>>` |

Query parameters (all optional):

| Param | Type | Notes |
|---|---|---|
| `categoryId` | UUID | Exact match |
| `brandId` | UUID | Exact match |
| `merchantId` | UUID | Exact match (this is the `MerchantProfile` id) |
| `minPrice` / `maxPrice` | number (2dp) | On `basePrice` |
| `minRating` | number, 0–5 | Products with no reviews are excluded when this is set |
| `inStock` | boolean | Coarse check (ignores reservations) — see §5 |
| `q` | string, max 255 | Matches product name, SKU, brand name, category name, or merchant business name |
| `sort` | enum | `newest` (default) \| `price_asc` \| `price_desc` \| `rating_desc` \| `popular` \| `recommended` |
| `cursor` | opaque string | From a previous response's `nextCursor`; omit for the first page |
| `limit` | integer, 1–100 | Default 20 |
| `lat` / `lng` | number | Accepted, not yet used — see §2 |

### `GET /products/featured`

Same query params as `/products` (minus `sort`, which is forced) — shortcut for `isFeatured=true, sort=newest`. Response shape identical to `/products`.

### `GET /products/new-arrivals`

Shortcut for `sort=newest` (same as `/products`' default — exists as a named, discoverable endpoint for the home screen). Same params/response shape as `/products`.

### `GET /products/trending`

Shortcut for `sort=popular`. Same params/response shape as `/products`.

### `GET /products/recommended`

Shortcut for `sort=recommended`. Same params/response shape as `/products`.

### `GET /products/:id` — Product detail

| | |
|---|---|
| **Auth** | None |
| **Path param** | `id` (UUID) |
| **Response** | `200` → `ApiSuccessResponse<ProductDetailDto>` |
| **Errors** | `404 NOT_FOUND` — product doesn't exist, or isn't `PUBLISHED`/is soft-deleted (both look the same to a customer) |

### `GET /products/:id/similar`

| | |
|---|---|
| **Auth** | None |
| **Path param** | `id` (UUID) |
| **Response** | `200` → `ApiSuccessResponse<ProductSummaryDto[]>` (max 6, newest-first, same category — or same brand if the product has no category) |
| **Errors** | `404 NOT_FOUND` |

Also embedded inline in `ProductDetailDto.relatedProducts` — this standalone endpoint is for a "load more similar" affordance if a screen wants one.

### `GET /categories`

| | |
|---|---|
| **Auth** | None |
| **Response** | `200` → `ApiSuccessResponse<CategoryDto[]>` — active categories only, alphabetical |

### `GET /brands`

| | |
|---|---|
| **Auth** | None |
| **Response** | `200` → `ApiSuccessResponse<BrandDto[]>` — active brands only, alphabetical |

## 4. Response schemas

```ts
interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;  // pass back as `cursor` for the next page
  hasMore: boolean;
}

interface ProductSummaryDto {
  id: string;
  merchantId: string;
  categoryId: string | null;
  brandId: string | null;
  name: string;
  slug: string;
  basePrice: number;
  currency: string;              // ISO 4217, e.g. "NGN"
  primaryImageUrl: string | null;
  rating: { average: number; count: number };
  inStock: boolean;
  isFeatured: boolean;
}

interface ProductDetailDto {
  id: string;
  merchantId: string;
  categoryId: string | null;
  brandId: string | null;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  currency: string;
  sku: string | null;
  isFeatured: boolean;
  publishedAt: string | null;    // ISO 8601
  images: ProductImageDto[];     // ordered by position
  variants: ProductVariantDto[]; // active variants only
  inStock: boolean;
  merchant: ProductMerchantSummaryDto | null;  // null only if the merchant has no Business record yet
  rating: { average: number; count: number };
  relatedProducts: ProductSummaryDto[];  // up to 6
}

interface ProductMerchantSummaryDto {
  merchantId: string;
  businessName: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
}

interface ProductImageDto {
  id: string; productId: string; url: string; altText: string | null;
  position: number; createdAt: string;
}

interface ProductVariantDto {
  id: string; productId: string; name: string; sku: string | null;
  priceOverride: number | null; isActive: boolean; createdAt: string; updatedAt: string;
}

interface CategoryDto {
  id: string; name: string; slug: string; description: string | null;
  parentId: string | null; isActive: boolean; createdAt: string; updatedAt: string;
}

interface BrandDto {
  id: string; name: string; slug: string; logoUrl: string | null;
  isActive: boolean; createdAt: string; updatedAt: string;
}
```

All of the above are exported from `@dripplex/types` (`packages/types/src/product/index.ts`) — the merchant-portal and customer-web codebases can import them directly rather than hand-typing payloads.

## 5. Business rules & validation

- Every list/detail endpoint hard-filters to `status = PUBLISHED AND isDeleted = false`. There is no way to see a draft, archived, or deleted product through this API, regardless of filters.
- `inStock` is a coarse filter: untracked-inventory products always pass; tracked products pass if `quantity > 0` (reservations aren't subtracted here — that precise check happens for real at cart-add/checkout, per R1.1). Don't treat this filter as an availability guarantee at the moment of add-to-cart.
- `minRating` excludes products with zero reviews when set (there's no aggregate row to compare against). Omit `minRating` to include everything.
- `rating_desc`/`popular`/`recommended` sort a capped candidate set (top 1000 filtered matches) in application code rather than at the database level, because rating and popularity aren't columns on `Product` — they're joined from `ReviewAggregate` and aggregated from `OrderItem`. Fine at today's catalog size; flagged in code (`customer-products.service.ts`) as something to revisit if a single category/merchant's result set grows large.
- Cursor tokens are opaque and offset-backed under the hood, not true keyset pagination — see §2. If a client changes `sort` mid-pagination without resetting `cursor`, the cursor is silently ignored and pagination restarts from the top rather than erroring.

## 6. Errors

Same platform-wide error envelope as every other endpoint:

```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "message": "Product not found",
  "path": "/products/...",
  "timestamp": "..."
}
```

The only error case specific to this milestone is `404 NOT_FOUND` on `/products/:id` and `/products/:id/similar`. Malformed query params (bad UUID, out-of-range number, unknown `sort` value) return the platform's standard `422` validation error shape.

## 7. Test results

98 → 102 suites, 651 → 685 tests (+34), all passing:
- `customer-products.service.spec.ts` (17) — integration test against real Postgres: every filter, both column-backed and computed-score sorts, search across all four fields, cursor pagination across pages, full product detail, similar products, category/brand listing.
- `cursor.util.spec.ts` (5), `product-search-sync.service.spec.ts` (5), `browse-products-query.dto.spec.ts` (7) — unit tests.

`pnpm lint` / `pnpm typecheck` both clean. Full command: `pnpm --filter @dripplex/backend test`.

## 8. Deferred (explicitly out of scope here)

- Writing/moderating reviews (rating data will stay at 0 until that milestone).
- Real geo-distance filtering/sorting (params accepted, inert).
- True keyset pagination and DB-level rating/popularity sort (documented limitation, not a blocker at current scale).
- Merchant/admin curation UI for `isFeatured` (the field and API support exist from this milestone; no screen to set it yet — R1.4).
- AI-driven search/recommendations (explicitly deferred per your instruction).

## 9. What's next

R1.4 (Merchant UI) and R1.5 (Customer Marketplace UI) can now be built against a stable, tested contract — nothing in §3–§4 should need to change shape for those milestones. If Nora's screens surface a need this contract doesn't cover (e.g., a filter combination, a field on `ProductSummaryDto`), flag it and I'll extend the contract rather than the frontend working around it.
