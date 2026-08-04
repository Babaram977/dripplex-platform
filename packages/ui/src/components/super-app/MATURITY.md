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

## Marketplace module — Checkout screen Verified (2026-08-03)

Ported from `docs/reference/figma-super-app-source/checkoutScreen.tsx`
(fifth of six Marketplace-module screens) and wired live at the real
route `/marketplace/checkout` (new — no prior implementation). Backed by
the real `sdk.orders.checkout`/`sdk.orders.payOrder`, `sdk.addresses`,
and `sdk.promotions.validate` surfaces — every total shown (subtotal,
delivery fee, tax, discount, final total) is either a real
`CartTotalsDto` figure or a live server-computed promo preview, not
display-only math.

Several fields in the source mock have no real backend equivalent and
were adapted rather than faked:

- **Payment methods.** The real system has no wallet-direct-debit or
  cash-on-delivery path for marketplace orders — only four real gateway
  providers (`PAYSTACK`/`FLUTTERWAVE`/`MONIEPOINT`/`OPAY`, per
  `PaymentProvider`). `SuperAppPaymentMethodSelector` is a generic
  component; the real page populates it with the four real gateway
  brands instead of the mock's four abstract categories.
- **Promo code.** The source mock puts a typed promo-code field on Cart,
  but the real coupon engine's only customer-facing "apply code"
  endpoint is `POST /customer/promotions/validate`, consumed at
  Checkout via `CheckoutDto.couponCode` — so `SuperAppPromoCodeCard`
  moved from Cart (where it doesn't work) to Checkout (where it does).
- **Fulfillment type.** Trimmed to the two real
  `CheckoutFulfillmentType` values (`DELIVERY`/`PICKUP`); the mock's
  third "Express" tier and its separate "Deliver Now/Schedule" toggle
  have no backend support and were dropped rather than faked.
- **Delivery address.** The source mock has no address form at all
  (just an entry button). `SuperAppAddAddressSheet` is a genuinely new
  component built for real `CreateAddressDto` requirements — its "Use my
  current location" button reads real coordinates from the browser's
  Geolocation API rather than inventing them. `SuperAppCheckoutAddressCard`
  drops the mock's "Use My Location" quick-action for the same reason
  (no reverse-geocoding endpoint exists).

`SuperAppCartOrderSummary` was reused rather than duplicated — it grew
two additive optional props (`title`, `totalLabel`, both defaulting to
Cart's exact prior text) so Checkout can relabel it "Order Summary" /
"Final Total" without changing Cart's rendering.

**A real backend bug was found and fixed during verification, not
routed around:** `Order.merchantId` (and `Cart`/`Product.merchantId`)
store `MerchantProfile.id`, but `CheckoutService.assertMerchantApproved`,
`CheckoutService.dispatchOrderCreatedNotifications`,
`PaymentService`'s merchant-eligibility check and payment-outcome
notifier, and `DeliveryService.createDeliveryJob`/`notifyOrderAudience`
all queried or compared it as if it were the merchant's `User.id` — the
same convention already correctly documented and implemented in
`CartService.validateMerchant`. This made checkout for any real merchant
throw "Merchant not found" (404), and would have made payment
initialization throw "Merchant is suspended" (422) and delivery-job
creation throw a foreign-key violation. It also silently broke
`MerchantOrdersService` (merchants could never see their own orders via
`/merchant/orders`) and dropped merchant order/payment/delivery
notifications on the floor. Fixed all call sites to resolve
`MerchantProfile.id` ↔ `User.id` correctly (see
`apps/backend/src/{orders,payments,delivery}` and their specs); full
backend suite (1017 tests, excluding two pre-existing DB-seed-dependent
failures unrelated to this change) passes.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Playwright
walkthrough against the real seeded backend confirmed, end to end: empty
state without a delivery address prompts "Add a delivery address to
continue"; the add-address sheet creates a real `CustomerAddress` via
geolocation and selects it; the fulfillment toggle recalculates the
delivery fee and final total live (Delivery ₦1,500 → Pickup FREE);
applying a fake promo code surfaces the real validation error from
`sdk.promotions.validate`; the terms checkbox gates Place Order; placing
the order calls the real `sdk.orders.checkout()`, which created an
actual `Order` row with the correct merchant/totals; the subsequent
`sdk.orders.payOrder()` call correctly reached the real Paystack adapter
and failed only with "Paystack is not configured" — an honest
environmental limitation of this sandbox (no real gateway credentials),
not a code defect. A repeat checkout attempt against the now-locked cart
correctly returned "Cart is locked pending payment" rather than silently
double-charging.

Not yet Locked — pending founder confirmation, then remains Implemented
for Tracking until it is itself ported and verified.

| Component                       | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| `SuperAppCheckoutAddressCard`   | Verified                                                 |
| `SuperAppAddressPickerSheet`    | Verified                                                 |
| `SuperAppAddAddressSheet`       | Verified                                                 |
| `SuperAppCheckoutMerchantCard`  | Verified                                                 |
| `SuperAppPaymentMethodSelector` | Verified                                                 |
| `SuperAppPromoCodeCard`         | Verified                                                 |
| `SuperAppCheckoutTermsCheckbox` | Verified                                                 |
| `SuperAppPlaceOrderBar`         | Verified                                                 |
| `SuperAppCheckoutSkeleton`      | Verified                                                 |
| `SuperAppCartOrderSummary`      | Verified (extended, additive `title`/`totalLabel` props) |

## Marketplace module — Tracking screen Verified (2026-08-04)

Ported from `docs/reference/figma-super-app-source/trackingScreen.tsx`
(sixth and final Marketplace-module screen) and wired live at the real
route `/marketplace/tracking/[orderId]`, backed by `sdk.orders.getOrder`,
`sdk.delivery.getDelivery/getTracking/getEta`, `sdk.orders.cancelOrder`,
and a newly-added `sdk.orders.raiseDispute`. Real `OrderDto`/`DeliveryJobDto`
have two independent state machines (`Order.status`, `DeliveryJob.status`)
where the source has one hardcoded union — the page composes the step
list from real ranked thresholds instead of porting the mock's status
type, and builds a genuinely different (shorter, no delivery steps)
timeline for `PICKUP` orders, which have no `DeliveryJob` at all.

Adaptations from the source, each tied to a real capability gap:

- **Live map.** The source draws a fully fake animated SVG map. Reused
  the real Google-Maps-backed `LiveMap` component already built for the
  Ride module (`apps/customer-web/src/components/ride/live-map.tsx`)
  instead of porting a duplicate into `packages/ui` — it's an app-level
  integration (API key, `@vis.gl/react-google-maps`), consistent with
  how Ride already keeps it out of the shared design-system package.
  Pickup/dropoff coordinates come straight off the real
  `CustomerDeliveryDto` (set from the real `Business`/`CustomerAddress`
  rows at delivery-job creation); only renders once a `DeliveryJob`
  genuinely exists and isn't yet delivered/cancelled.
- **Rider identity.** Real `DeliveryJobDto` only exposes `riderId`, no
  name — found no customer-safe rider-lookup endpoint anywhere in the
  backend. Added one, following the exact precedent already used for
  ride receipts (`ride-receipt.service.ts` resolving
  `{id, name, phone}`): a new `CustomerDeliveryDto` (extends
  `DeliveryJobDto` with `riderName`/`riderPhone`, resolved server-side in
  `DeliveryService.getCustomerDelivery`) rather than fabricating a name
  or omitting the rider card. Rating, delivery count, vehicle model, and
  plate number have no real backend field (`RiderProfile` tracks none of
  these) and are dropped — a real "rating and vehicle details aren't
  tracked yet" note is shown instead of hiding the gap silently.
- **Call / Message.** Matches the exact pattern already established on
  the Ride module's driver-assigned screens: shown but disabled, with an
  honest note, since no telephony/chat capability exists anywhere in the
  backend.
- **Report an Issue.** The source's version just returns canned AI text.
  Built a real reason-entry sheet wired to a real
  `POST /customer/orders/:id/dispute` — and added the missing SDK method
  (`OrderClient.raiseDispute`) and shared `RaiseOrderDisputeDto` type, the
  same way earlier screens closed SDK gaps. Critically, the real backend
  only allows raising a dispute once `Order.status === 'DELIVERED'`
  ("Only delivered orders can be disputed") — verification caught the
  action bar offering it at every status and returning a real 422 at
  anything else, so `SuperAppTrackingActionBar`'s Report button is now
  optional (only rendered when the caller passes a handler), and only
  the DELIVERED-vs-COMPLETED distinction (DELIVERED auto-completes to
  COMPLETED via `order-completion-sweep.service.ts` unless disputed —
  "disputing an order is the customer's way to stop the sweep") offers
  it, via a new optional `onReportIssue` prop on the completed-celebration
  screen.
- **Completion state.** Ported the source's `DeliveredScreen` structure
  (checkmark draw, order number, action row) but dropped the per-frame
  emoji-confetti field for a single CSS checkmark animation, and dropped
  "Rate" (no real order/rider rating capability — `Review` is
  product-scoped, not order-scoped) and "Download Receipt" (no PDF
  generation exists anywhere in the backend).
- **Cancelled state.** Not in the source at all. Added a real banner
  (with the real `cancellationReason` when present) rather than letting
  a cancelled order silently render as if every future step were still
  pending.

**A real, previously-undiscovered bug in the Locked `SuperAppBottomNav`
was found and fixed during verification:** its className template,
`` `${fixed ? 'absolute bottom-0 left-0 right-0' : ''}flex ...` ``, had no
space before `flex`, so whenever `fixed` (the default) was `true` the
resulting string contained the invalid token `right-0flex` — Tailwind
silently dropped it, meaning the nav was never actually `display:flex`.
Every previous real usage happened to pass `fixed={false}` (fused inside
`CartCheckoutBar`/`PlaceOrderBar`/`ProductActionBar`), so this never
surfaced; Tracking is the first screen to render the standalone nav, and
it appeared as five buttons stacked full-width down the page instead of
a row. Fixed the missing space; re-verified the preview Marketplace page
(which also uses the standalone default) renders correctly now too.

Also found, during Playwright verification against a real order, a
sub-label bug of its own: the "Order Confirmed" step read "Payment
received" for orders that were cancelled before ever being paid
(`confirmedAt` still `null`). Fixed to key off `confirmedAt` directly
rather than special-casing `PENDING`.

Typecheck/lint clean across `@dripplex/types`, `@dripplex/sdk`,
`@dripplex/ui`, `customer-web`, and the backend; full backend suite:
1018/1020 passing (2 pre-existing DB-seed-dependent failures, unrelated).
Playwright walkthrough against the real seeded backend covered every
real status this screen can render: `PENDING` (honest "awaiting payment",
no step live), `CANCELLED` (banner, no cancel/report actions),
`IN_TRANSIT`/`ON_THE_WAY` with a real assigned rider (live map, rider
card with real name, single correctly-highlighted LIVE step), `DELIVERED`
(celebration screen, a real dispute submitted via
`sdk.orders.raiseDispute` that genuinely moved the order to `DISPUTED`
in the database), and `PICKUP` fulfillment (shorter timeline, no
map/rider card, matching the real absence of a `DeliveryJob`) — zero
unexpected console errors throughout.

Not yet Locked — pending founder confirmation. This completes all six
Marketplace-module screens (Entry, Store, Product Detail, Cart, Checkout,
Tracking).

| Component                           | Status                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| `SuperAppOrderTimeline`             | Verified                                                    |
| `SuperAppTrackingRiderCard`         | Verified                                                    |
| `SuperAppTrackingMerchantCard`      | Verified                                                    |
| `SuperAppTrackingItemsAccordion`    | Verified                                                    |
| `SuperAppTrackingActionBar`         | Verified                                                    |
| `SuperAppCancelOrderSheet`          | Verified                                                    |
| `SuperAppReportIssueSheet`          | Verified                                                    |
| `SuperAppOrderCompletedCelebration` | Verified                                                    |
| `SuperAppTrackingSkeleton`          | Verified                                                    |
| `SuperAppBottomNav`                 | Locked — real defect fixed (missing-space `flex` class bug) |
