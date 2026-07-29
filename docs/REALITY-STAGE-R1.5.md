# Reality Stage R1.5 — Customer Marketplace UI — Design Handoff Package

**Date:** 2026-07-28
**Branch:** `claude/dripplex-coolify-deploy-fatig4`
**Commits:** `1693f59` (backend), `456c9e8` (frontend)
**Status:** Backend + frontend complete, typecheck/lint clean, manually browser-verified end-to-end against a live local backend with seeded data. **Not yet applied to Railway** — same standing caveat as every prior Reality Stage: this session has no Railway deploy access.

---

## 1. Summary

R1.5 is the first production implementation of HOME-002: a real, working customer marketplace. Anonymous visitors can browse merchants and products, filter and sort, and search with a lightweight "smart" parser; signed-in customers can add to cart, favourite, and share. Nothing here is a mock — every screen is wired to the live R1.3/R1.5 backend, and the whole flow was verified end-to-end in a browser against seeded merchants and products.

Two things happened that are worth understanding before anyone builds on top of this:

**A backend gap had to be closed first.** R1.3 shipped product browsing only — there was no public API for "list merchants" or "merchant profile," which R1.5's Merchant Listing and Merchant Mini Store both need. That became R1.5's backend phase (`GET /merchants`, `GET /merchants/:id`, both smart-search endpoints), documented in the earlier backend-only commit. It also meant catching a real bug before it shipped: `Business.merchantId` references `User.id`, but `Product.merchantId` references `MerchantProfile.id` — same field name, different ID space. The merchant browse/detail DTOs now resolve the correct id explicitly, with a test asserting it.

**Two more real bugs surfaced during frontend verification, neither introduced by R1.5, both now fixed:**

1. `@dripplex/types`'s `package.json` `exports` map had no CJS `require`/`default` condition — the backend's compiled `dist/main.js` could never actually boot via a plain `node dist/main.js`, because every file importing `@dripplex/types` (nearly the whole backend) would throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. Fixed by adding a `"default"` condition; `"import"` still wins for real ESM consumers, so this is purely additive and doesn't touch how any frontend app already consumes the package.
2. `CartService.validateMerchant` looked up `MerchantProfile` by `userId: merchantId` — the same class of ID-space bug as above, but in the pre-existing Cart module. Since every product's `merchantId` is `MerchantProfile.id`, **every real Add to Cart call from the marketplace would have failed** with a false "Merchant not found" 404. Confirmed via a live request (404 before the fix, 201 after), fixed with a one-line query change, and confirmed the existing mocked `cart.service.spec.ts` suite doesn't assert on the exact `where` clause (so it still passes unchanged — it just never would have caught this, which is exactly why it went undetected until a real request hit it).

## 2. What's built

**Routes** (new `(public)/marketplace` route group in `apps/customer-web` — anonymous browsing allowed, matching R1.3's `@Public()` backend, no auth gate):

| Route                        | Purpose                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/marketplace`               | Home — smart search bar, category strip, featured merchants, promotions (signed-in only — see §3), links into browse                                                                                                            |
| `/marketplace/merchants`     | Merchant Listing — business-type/rating filters, recommended/nearest/rating/newest sort, opt-in "Use my location," infinite scroll                                                                                              |
| `/marketplace/merchants/:id` | Merchant Mini Store — the standardized store entry point the founder specified (not a restaurant/supermarket-specific layout): profile header + that merchant's product grid, reusing the same `ProductCard` as everywhere else |
| `/marketplace/products`      | Product Listing — price/rating/in-stock filters, full sort set, infinite scroll, deep-linkable via `?categoryId=` from the category strip                                                                                       |
| `/marketplace/products/:id`  | Product Detail — image gallery, merchant link, cart/favourite/share, similar products                                                                                                                                           |
| `/marketplace/search`        | Smart search results — runs the query against both `products.smartSearch` and `merchants.smartSearch` in parallel, shows what the parser extracted (price ceiling / near me / open now) as chips above the results              |

**Cart/Favourite/Share** on every product card (listing grids, Mini Store, search results, and the detail page): quantity selector, Add to Cart, Favourite (heart), Share. All three require sign-in on the backend (`customer:cart:manage` / `customer:wishlist:manage`) — anonymous clicks show a toast and redirect to `/login` rather than silently failing. Favourite auto-creates a single default "Favourites" wishlist on first use, since the backend wishlist model is multi-list, not single-favourites, and R1.5 only needed one heart icon, not a wishlist-management UI.

**SDK**: `CustomerProductsApi` and `CustomerMerchantsApi` (`sdk.products` / `sdk.merchants`), wired into `DripplexClient` and the customer SDK barrel. This closes a real gap flagged during research — R1.3 shipped a backend with zero SDK coverage, so nothing in `customer-web` could have called it before this.

**Performance/accessibility**: `loading="lazy"` on every product/merchant image, a shared `Skeleton`-based grid loading state, IntersectionObserver-based infinite scroll (`useInfiniteScroll`), semantic Tailwind tokens throughout (dark-mode-safe by construction, same as R1.4), `aria-label` on every icon-only button, `role="search"`/`role="alert"` where appropriate.

## 3. What Nora needs to know before a Figma conformance pass

- **This is intentionally plain**, same posture as R1.4 — correctness first, visual refinement is an explicit follow-up once Figma access returns.
- **"Discount" is not on product cards.** There is no discount/compare-at-price field anywhere in the product schema, and no reliable way to map the existing Promotions system to a specific product's card. Rather than fabricate a badge, it's simply not rendered. If per-product discount pricing is wanted, that's schema work, not a UI gap.
- **"Delivery ETA" is a client-side estimate, not real logistics data.** There's no ETA/prep-time data source on the backend. `formatDeliveryEstimate()` computes a rough `~X min` from the (real) distance using a fixed speed assumption, clearly commented as a heuristic, and only renders when a distance is actually known (i.e., only after the customer opts into sharing location). It is not wired to anything real about the specific merchant.
- **Promotions only appear for signed-in customers.** `GET /customer/promotions/active` requires auth on the backend — it's not `@Public()`. Anonymous visitors on Marketplace Home simply don't see the promotions strip at all; this isn't a bug in the frontend, it's the actual shape of that endpoint today.
- **Smart search is exactly what was scoped: structural parsing, not real NLP.** It correctly extracts price ceilings, "near me," and "open now" and passes the remainder as a literal keyword search — it does not understand synonyms (e.g., searching "Laptop" will not match a product named "UltraBook" unless the word "Laptop" literally appears somewhere in its name/SKU/brand/category/merchant name). This was verified directly during testing and is working as designed, not a defect — full conversational search is still deferred, per your decision.
- **"Featured merchants" on the home page and every listing/sort default to `recommended`, which is the same heuristic as `rating_desc`** — there's no real personalization or recommendation engine, same honesty caveat R1.3 already established for products.
- **List pagination is infinite-scroll everywhere** (cursor-based, matching R1.3's product API and R1.5's new merchant API) — don't design numbered pagination for these screens.

## 4. Verification performed

- `pnpm --filter @dripplex/backend test` — 709/709 passing (full suite, including the cart fix's regression coverage)
- `pnpm --filter @dripplex/backend lint` — clean
- `pnpm --filter @dripplex/sdk test` — 62/62 passing (10 new, covering both new API classes)
- `pnpm --filter @dripplex/sdk lint`, `build` — clean
- `pnpm --filter @dripplex/types build`, `lint` — clean
- `pnpm --filter @dripplex/customer-web typecheck`, `lint`, `test` — clean
- Typecheck re-run for `merchant-portal`, `admin-portal`, `rider-portal`, `operations-console` to confirm the shared SDK/types changes didn't break any other portal — clean
- **Manual browser walkthrough** against a live local backend with seeded merchants (3, one intentionally left `PENDING` verification), products (4, with ratings/images), and a real customer account — no mocks:
  - Anonymous: Marketplace Home renders search/categories/featured merchants → category click navigates to filtered Product Listing → Merchant Listing renders with filters/sort/location opt-in → Merchant Mini Store renders profile + real product grid → Product Detail renders gallery/price/rating → Smart search for a real keyword returns real matches; a non-matching keyword correctly returns an honest empty state (not an error) → anonymous "Add" click correctly redirects to `/login`.
  - Authenticated (real login): Add to Cart succeeds (confirmed via the actual `POST /customer/cart/items` response — this is what caught the `validateMerchant` bug), toast confirms; Favourite succeeds (confirmed via `POST /customer/wishlists`), and a duplicate favourite correctly returns `409` rather than erroring.
  - No console or page errors at any step, aside from expected external-image load failures from this sandbox's network policy (the seeded picsum.photos URLs — unrelated to the app, would load fine with real network access or real merchant-uploaded images).
- Test data (3 merchants, 4 products, 1 customer, associated cart/wishlist/review rows) fully deleted after verification; confirmed zero orphaned rows afterward.

## 5. Suggested next step

R1.6 — Reality Verification, per the roadmap: with R1.4 and R1.5 both now real, browser-verified, end-to-end features, this is the point to re-run a Production Readiness Audit (Step 4 of the earlier recovery plan) and decide what "launch-ready" actually requires from here — most notably, checkout/order-placement was explicitly out of scope for R1.5 (cart-adding works; there's no checkout UI yet), and merchant onboarding (flagged as a gap in R1.4) still doesn't have a UI.
