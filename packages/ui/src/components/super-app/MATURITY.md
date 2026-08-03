# Super App component maturity (DPX-102)

Every component in this directory carries one status, tracked here as the
single source of truth (not scattered per-file tags, to keep it one place to
check before touching anything):

```
Experimental → Implemented → Verified → Locked
```

- **Experimental** — shape still changing, not yet matched against the
  locked Figma export.
- **Implemented** — ported from the export, not yet browser-verified.
- **Verified** — typecheck/lint clean and confirmed via Playwright
  screenshot against the export with zero console errors.
- **Locked** — founder-approved as pixel-final. Visual properties (color,
  spacing, radius, shadow, typography, animation) and the public prop API
  cannot change without explicit founder approval. Bug fixes (e.g.
  correctness, accessibility, a real defect) are still allowed — "locked"
  protects against redesign drift, not against fixing something broken.

Locking happens per module, after the founder confirms that module's
screens are done — not automatically when a component merges.

## Home module — Locked (2026-08-03)

Founder-confirmed via the DPX-100/DPX-101 Home walkthrough (Playwright
verification, zero console errors, pixel-identical to
`docs/reference/figma-super-app-source/homeScreen.tsx`) as the reference
implementation every other module reuses.

| Component                                   | Status  |
| ------------------------------------------- | ------- |
| `SuperAppFontProvider` / `useSuperAppFonts` | Locked  |
| `SuperAppSkeleton`                          | Locked  |
| `SuperAppSectionHeader`                     | Locked¹ |
| `SuperAppStatusBarIcons`                    | Locked  |
| `SuperAppBottomNav`                         | Locked  |
| `SuperAppAIFab`                             | Locked  |
| `SuperAppAISheet`                           | Locked¹ |
| `SuperAppAvatar`                            | Locked  |
| `SuperAppNotificationBell`                  | Locked  |
| `SuperAppGreetingHeader`                    | Locked  |
| `SuperAppSearchBar`                         | Locked  |
| `SuperAppHeader`                            | Locked  |
| `SuperAppServiceTabs`                       | Locked  |
| `SuperAppWalletActions`                     | Locked  |
| `SuperAppBalanceCard`                       | Locked  |
| `SuperAppQuickActionsGrid`                  | Locked  |
| `SuperAppCategoryGrid`                      | Locked  |
| `SuperAppHorizontalSection`                 | Locked  |
| `SuperAppMerchantCard`                      | Locked  |
| `SuperAppRecommendationCard`                | Locked  |
| `SuperAppActivityList`                      | Locked  |
| `SuperAppPromoCarousel`                     | Locked  |
| `SuperAppAIWidget`                          | Locked  |

¹ Extended additively for Marketplace (new optional params: `subtitle`/
`showSeeAll` on `SectionHeader`, `title`/`subtitle`/`showIcons` on
`AISheet`). All new params default to Home's exact prior values —
re-verified via Playwright after the change that Home's rendering is
byte-for-byte unchanged (see `docs/reference/figma-super-app-source/homeScreen.tsx`
walkthrough, 2026-08-03). Still Locked for Home's own usage; the new
defaults are what's open for a different module's own future reuse.

## Marketplace module — entry screen Verified, founder-confirmed (2026-08-03)

Ported from `docs/reference/figma-super-app-source/marketplaceScreen.tsx`
(`MarketplaceScreen`, the module's home/entry screen only). Typecheck/lint
clean; Playwright walkthrough (top, mid-scroll, lower, bottom, AI sheet)
shows zero console errors and matches the source. Founder reviewed the
screenshots and confirmed Verified status; not yet Locked (Locking waits
until the full Marketplace flow — Store, Product Detail, Cart, Checkout,
Tracking — is complete and verified, per founder direction).

| Component                                                         | Status                                                                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SuperAppVerifiedBadge`                                           | Verified                                                                                                                          |
| `SuperAppMarketplaceHeader`                                       | Verified                                                                                                                          |
| `SuperAppCategoryChips`                                           | Verified                                                                                                                          |
| `SuperAppAIDiscoveryBanner`                                       | Verified                                                                                                                          |
| `SuperAppDealsCarousel`                                           | Verified                                                                                                                          |
| `SuperAppFeaturedMerchantCard`                                    | Verified                                                                                                                          |
| `SuperAppFeaturedMerchantsSection`                                | Verified                                                                                                                          |
| `SuperAppVerticalListCard`                                        | Verified                                                                                                                          |
| `SuperAppNearbyBusinessRow` / `SuperAppNearbyBusinessSkeletonRow` | Verified                                                                                                                          |
| `SuperAppProductCard`                                             | Verified                                                                                                                          |
| `SuperAppAIRecommendationCard`                                    | Verified                                                                                                                          |
| `SuperAppRecentlyViewedCard`                                      | Verified                                                                                                                          |
| `SuperAppEmptyState`                                              | Verified (ported but not wired into the default screen render — matches the source, which defines it but never renders it either) |

## Marketplace module — Store screen Verified (2026-08-03)

Ported from `docs/reference/figma-super-app-source/storeScreen.tsx`
(`StoreScreen`, second of six Marketplace-module screens). Typecheck/lint
clean; Playwright walkthrough (top, product grid, reviews, policies/info,
and an interactive Add-to-Cart round trip confirming the header's cart
badge updates) shows zero console errors and matches the source. Not yet
Locked — pending founder confirmation, then remains Implemented for
Product Detail, Cart, Checkout, and Tracking until each is itself ported
and verified.

| Component                  | Status   |
| -------------------------- | -------- |
| `SuperAppStoreHeader`      | Verified |
| `SuperAppStoreSearchBar`   | Verified |
| `SuperAppTextChips`        | Verified |
| `SuperAppStoreProductCard` | Verified |
| `SuperAppProductGrid`      | Verified |
| `SuperAppReviewsSection`   | Verified |
| `SuperAppAccordionCard`    | Verified |
| `SuperAppInfoList`         | Verified |

## Marketplace module — Product Detail screen Verified (2026-08-03)

Ported from `docs/reference/figma-super-app-source/productDetailScreen.tsx`
(third of six Marketplace-module screens) and wired live into the real,
public production route `/marketplace/products/[id]` — replacing that
route's previous shadcn-based UI in place per founder direction, while
preserving all existing business logic: `sdk.products.get`,
`addProductToCart`/`addProductToFavourites`, `requireAuth` gating, the
native Web Share API + clipboard fallback, and `describeSdkError` error
handling. Also newly wires `sdk.reviews.listForTarget('PRODUCT', id)`,
which the page never called before.

Per founder direction, the route also moved out of the marketing site's
`(public)` Navbar/Footer shell into a new full-bleed SuperApp shell
(`apps/customer-web/src/app/(marketplace)/layout.tsx`, modeled on the
existing `(ride)/ride/layout.tsx` precedent) — DrippleX's app screens use
the Figma-locked navigation chrome (own back button, bottom tab bar), not
the website's. Store and Marketplace-entry screens still await this same
route migration.

Fields the source's mock has no real backend equivalent for — cashback
badge, sold count, spec-sheet table, delivery ETA/fee/pickup/returns
block, and the entire "Ask Drip" AI prompt/response card — are omitted
rather than faked; the floating AI button is likewise omitted until the
Ask Drip AI module exists. The source's 3-independent-grouped variant
picker (Meal Size/Spice Level/Drink) is rendered as one flat chip row,
since the real `ProductVariantDto` is an ungrouped list. "Buy Now" only
renders when a caller wires `onBuyNow` — there is no real express-checkout
flow yet, so the composed page omits it.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Playwright
walkthrough against a locally seeded product (real Postgres + backend,
not mocked) confirmed: gallery/info/description/variants/quantity render
from real data; the reviews section's rating breakdown and review cards
render from a real `ReviewAggregateDto` row with zero console errors;
"You May Also Like" renders real related products; anonymous Add to Cart
redirects to `/login`; authenticated Add to Cart shows the real
`SuperAppCartConfirmationSheet`; authenticated favourite toggling shows
both the success toast and (on a real 409 conflict) the destructive-toast
error path, matching the preserved `describeSdkError` handling. One real
backend bug was found and fixed in the process: `ReviewsController`
(`GET /reviews`) was missing the `@Public()` decorator its own public,
no-auth-guard intent required, so anonymous review reads were 401ing —
now fixed to match the pattern used by `CustomerProductsController`.

Not yet Locked — pending founder confirmation, then remains Implemented
for Cart, Checkout, and Tracking until each is itself ported and
verified.

| Component                        | Status   |
| -------------------------------- | -------- |
| `SuperAppProductGallery`         | Verified |
| `SuperAppProductInfoHeader`      | Verified |
| `SuperAppProductDescription`     | Verified |
| `SuperAppProductVariantSelector` | Verified |
| `SuperAppQuantityStepper`        | Verified |
| `SuperAppProductQuantityRow`     | Verified |
| `SuperAppMerchantMiniCard`       | Verified |
| `SuperAppProductReviewsSection`  | Verified |
| `SuperAppRelatedProductCard`     | Verified |
| `SuperAppRelatedProductsSection` | Verified |
| `SuperAppProductActionBar`       | Verified |
| `SuperAppCartConfirmationSheet`  | Verified |
| `SuperAppProductDetailSkeleton`  | Verified |

`SuperAppBottomNav` (Home, Locked) gained an additive `fixed` prop
(defaults `true`, reproducing every existing caller's exact prior output)
so Product Detail's fused action-bar-plus-tab-bar footer can render it
in-flow (`fixed={false}`) instead of as a second competing absolute
overlay — the Locked component's default behavior is unchanged.

## Marketplace module — Cart screen Verified (2026-08-03)

Ported from `docs/reference/figma-super-app-source/cartScreen.tsx`
(fourth of six Marketplace-module screens) and wired live at the real
route `/marketplace/cart` (new — this screen had no prior real
implementation to replace). Backed entirely by the real `sdk.cart`
surface (`get`/`addItem`/`updateItem`/`removeItem`) and real
`CartDto`/`CartTotalsDto` — subtotal, delivery fee, and tax are all
figures computed by the real backend pricing engine, not display-only
math.

The real `Cart` model is single-merchant per customer (adding a product
from a different merchant throws `CartMerchantConflictDomainException`),
so unlike the source's multi-merchant mock, the real page only ever
composes one `SuperAppCartMerchantGroup` — the component itself stays
general because that's a real backend rule, not a UI shortcut. Fields
with no real backend equivalent are omitted rather than faked: per-item
discount badges, the out-of-stock overlay (no live per-item stock
re-check on the cart response), the "Price updated" notice, per-item
variant text (no variant name snapshot on `CartItemDto`), merchant
cashback, the typed promo-code input (the coupon engine has no
customer-facing "apply code" endpoint — only automatic, non-code
discounts), the 3-way delivery-mode selector (no mode parameter on the
real delivery-fee calculator), and the "Ask Drip" AI card. A real `Tax`
row (present on `CartTotalsDto`, absent from the source's mock) is shown
instead of hidden.

"Save for Later" is a genuinely real feature, not omitted: it removes
the item from the cart and adds it to the customer's default wishlist —
the same list the Marketplace/Product Detail favourite heart writes to
— and "Saved for Later" lists real wishlist items resolved against the
product catalog (`WishlistItemDto` has no name/price/image snapshot, so
each item is resolved via `sdk.products.get`), with a real "Add to Cart"
action that moves it back and off the wishlist.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Playwright
walkthrough against the same locally seeded product (real Postgres +
backend) confirmed, end to end, with zero unexpected console errors:
add-to-cart from Product Detail reflected immediately on `/marketplace/cart`;
quantity increment/decrement recalculates subtotal/tax/grand total via
real backend responses; "Save" removes the line item and surfaces it
under "Saved for Later" with resolved product data; "Add to Cart" from
Saved for Later moves it back into the cart and off the wishlist; the
remove (×) button empties the cart and shows the real empty state.

Not yet Locked — pending founder confirmation, then remains Implemented
for Checkout and Tracking until each is itself ported and verified.

| Component                      | Status   |
| ------------------------------ | -------- |
| `SuperAppCartItemRow`          | Verified |
| `SuperAppCartMerchantGroup`    | Verified |
| `SuperAppCartOrderSummary`     | Verified |
| `SuperAppCartEmptyState`       | Verified |
| `SuperAppCartCheckoutBar`      | Verified |
| `SuperAppSavedForLaterSection` | Verified |
| `SuperAppCartSkeleton`         | Verified |

Checkout and Tracking screens: not yet started — these remain unwritten,
not merely "Implemented."
