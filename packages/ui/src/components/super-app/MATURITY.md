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

## Ride module — Slice 1: shared UI kit + Home screen (2026-08-04)

Unlike Marketplace, Ride already had a complete, real, backend-connected
implementation before DPX-100 — 22 screens built and Playwright-verified
across RIDE-003 Slices 1-4, living in
`apps/customer-web/src/components/ride/` with their own shared primitive
library (`ride-ui.tsx`) rather than `packages/ui`. This slice is the
first of several bringing that already-working module onto the
`packages/ui/super-app` design system, the same way Marketplace was
built: **no new backend work, no new hooks, no behavior change** — only
moving presentational markup into `packages/ui` and having the
already-wired screen component (which stays in `customer-web`, since it
owns the real hooks/backend calls) compose it instead of hand-rolling
markup inline.

**Ported this slice:**

- `ride-ui.tsx`'s shared primitives → `RideStatusBar`, `RideBackArrow`,
  `RideSafetyChip`, `RideHeader` (`RideChrome.tsx`); `RideActionButton`,
  `RideQuickActionButton` (`RideActionButton.tsx`); `RideBottomSheet`;
  `RideStatusBanner`; `RideETAChip`; `RideFareBreakdown`; `RideDriverCard`
  (kept the source's honest capability-gap copy — no customer-facing
  driver-profile endpoint or vehicle fields exist in the backend);
  `RideMapCanvas` (the decorative SVG fallback map).
- `RideHomeScreen`'s own markup decomposed into three new focused
  components rather than one monolith, matching the granularity already
  established for the Tracking screen: `RideDestinationTrigger` (the
  "Where are you going?" button), `RideQuickPlaces` (Home/Work chips),
  `RideSavedPlacesList` (the saved-places section with loading/error/empty
  states).
- Updated `LiveMap` (`apps/customer-web/src/components/ride/live-map.tsx`)
  to import its fallback from `SuperAppRideMapCanvas` (`@dripplex/ui`)
  instead of the local `ride-ui.tsx` copy — the first concrete step
  toward retiring `ride-ui.tsx` once every screen that depends on it is
  migrated.
- Migrated `(ride)/ride/layout.tsx` off its raw `<link>`-tag Google Fonts
  CSS load onto `next/font/google` + `SuperAppFontProvider`, matching the
  convention every other DPX-100 module layout already uses — required
  so the new components' `useSuperAppFonts()` calls resolve real
  classNames instead of the context default (`''`). Same two font
  families (Poppins/Inter), same weights — no visual change, just how
  they load.
- `ride-home-screen.tsx` itself now composes the above instead of
  duplicating their markup inline. All existing hooks
  (`useAuth`, `useSavedPlaces`, `useCurrentLocation`, `useNearbyDrivers`)
  and the `LiveMap` real-map integration are untouched.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend (real seeded customer, real
`useSavedPlaces`/`useCurrentLocation` data): the ported Home screen
renders pixel-equivalent to the pre-port version (fallback map SVG since
no Google Maps key is configured locally, safety chip, history button,
search trigger, quick places, saved places list, all real data), zero
console errors; clicking through to the still-unported Destination
Search and Ride History screens confirms the `ride-flow.tsx` state
machine transitions are unaffected by the swap.

Not yet Locked. `ride-ui.tsx` stays in place — it's still the primitive
source for the 21 screens not yet ported in this slice.

| Component                        | Status   |
| -------------------------------- | -------- |
| `SuperAppRideStatusBar`          | Verified |
| `SuperAppRideBackArrow`          | Verified |
| `SuperAppRideSafetyChip`         | Verified |
| `SuperAppRideHeader`             | Verified |
| `SuperAppRideActionButton`       | Verified |
| `SuperAppRideQuickActionButton`  | Verified |
| `SuperAppRideBottomSheet`        | Verified |
| `SuperAppRideStatusBanner`       | Verified |
| `SuperAppRideETAChip`            | Verified |
| `SuperAppRideFareBreakdown`      | Verified |
| `SuperAppRideDriverCard`         | Verified |
| `SuperAppRideMapCanvas`          | Verified |
| `SuperAppRideDestinationTrigger` | Verified |
| `SuperAppRideQuickPlaces`        | Verified |
| `SuperAppRideSavedPlacesList`    | Verified |

## Ride module — Slice 2: Search + Fare + Finding + Assigned (2026-08-04)

Continues the Slice 1 re-platform: presentational markup only, no new
backend work, no behavior change. Ported `DestinationSearchScreen`,
`FareEstimateScreen`, `FindingDriverScreen`, `DriverAssignedScreen`, and
`DriverProfileSheet` off `ride-ui.tsx` onto `packages/ui`.

**New components this slice:**

- `RideSearchInputRow` — rounded pill wrapper with the pickup dot; the
  real `PlacesAutocompleteInput` (Maps-SDK dependent) stays in
  `customer-web` and renders inside it as `children`.
- `RidePlaceRow` — single place-list row, reused for both the saved-place
  suggestions on Destination Search and (in a later slice) Saved Places.
- `RideTypeSelector` — the Economy/Tricycle chip row on Fare Estimate.
- `RideInfoBox` — small rounded neutral/error message box, reused for
  loading, error, waiting, and the location-denied warning states.
- `RideTextButton` — muted inline text link ("Cancel ride", "Back to
  Home").
- `RideLiveBadge` — the LIVE/CONNECTING pill on Driver Assigned.

`DriverAssignedScreen` and `DriverProfileSheet` compose these plus the
Slice 1 primitives (`RideHeader`, `RideBottomSheet`, `RideDriverCard`,
`RideETAChip`, `RideActionButton`, `RideQuickActionButton`,
`RideStatusBanner`); the real `LiveMap` (Google Maps SDK) still renders
directly in the screen component, per the established map-handling
pattern. `DriverProfileSheet`'s honest "Integration status" copy (no
customer-facing driver-profile endpoint or vehicle fields in the backend)
is kept inline in the screen rather than extracted, since it's one-off
explanatory content tied to this single generated screen.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend: a full booking round trip
(destination select → ride-type toggle re-triggering the real fare
estimate → book → a real driver, driven via direct API calls, receives
and accepts the dispatch offer → the customer's existing 4s poll-fallback
picks up the `DRIVER_ASSIGNED` transition → Driver Assigned screen renders
live map/ETA/driver card/live badge → Driver Profile sheet opens from the
driver card) completed end to end with zero console errors.

| Component                    | Status   |
| ---------------------------- | -------- |
| `SuperAppRideSearchInputRow` | Verified |
| `SuperAppRidePlaceRow`       | Verified |
| `SuperAppRideTypeSelector`   | Verified |
| `SuperAppRideInfoBox`        | Verified |
| `SuperAppRideTextButton`     | Verified |
| `SuperAppRideLiveBadge`      | Verified |

## Ride module — Slice 3: En route + Arrived + In-progress + Live tracking (2026-08-04)

Continues the re-platform: presentational markup only, no new backend
work, no behavior change. Ported `DriverEnRouteScreen`,
`DriverArrivedScreen`, `RideInProgressScreen`, and `LiveTrackingScreen`
off `ride-ui.tsx` onto `packages/ui`.

**New components this slice:**

- `RideProgressBar` — the trip-progress track (0-1) shown on Live
  Tracking.
- `RideRouteSummary` — the pickup/dropoff address pair with connecting
  dots, shown on Ride In Progress.

All four screens compose these plus Slice 1/2 primitives (`RideHeader`,
`RideBottomSheet`, `RideDriverCard`, `RideStatusBanner`, `RideETAChip`,
`RideActionButton`, `RideQuickActionButton`, `RideSafetyChip`,
`RideBackArrow`, `RideStatusBar`, `RideTextButton`); the real `LiveMap`
still renders directly in each screen component. Live Tracking's
LIVE/CONNECTING badge uses a distinct dot+pill treatment from the
plain-pill `RideLiveBadge` used on Driver Assigned/En Route — this
matches the real source markup for that screen exactly (different
background shade, has a dot indicator) and was kept inline rather than
force-fit onto `RideLiveBadge`, to avoid silently changing either
screen's actual appearance.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend: booked a fresh ride, drove the
full trip lifecycle via direct driver API calls (accept offer → arrive →
start), and confirmed each real status transition
(`DRIVER_ASSIGNED`→`ARRIVED`→`IN_PROGRESS`) correctly advanced the
customer's screen (Assigned → En Route → Arrived → In Progress → Live
Tracking, the last two reached via in-app navigation) with zero console
errors throughout.

| Component                  | Status   |
| -------------------------- | -------- |
| `SuperAppRideProgressBar`  | Verified |
| `SuperAppRideRouteSummary` | Verified |

## Ride module — Slice 4: Trip completion + payment screens (2026-08-04)

Continues the re-platform: presentational markup only, no new backend
work, no behavior change. Ported all nine post-trip screens —
`TripCompletedScreen`, `PaymentScreen`, `GatewayPaymentScreen`,
`CashPaymentScreen`, `WalletPaySuccessScreen`, `TipDriverScreen`,
`RateDriverScreen`, `TripReceiptScreen`, `ReportTripScreen` — off
`ride-ui.tsx` onto `packages/ui`.

**New components this slice:**

- `RideDetailCard` — label/value row list with a bold highlighted footer
  row (fare total), used on Trip Completed.
- `RideReceiptCard` — receipt header (ID + status pill) plus a row list,
  used on Trip Receipt.
- `RidePaymentSummary` — route label + large fare-amount hero block, used
  on Payment.
- `RidePaymentMethodRow` — selectable payment-method row with a radio
  indicator and optional balance subtitle, used on Payment.
- `RideOptionRow` — selectable icon+label row (no radio), used for the
  issue-category picker on Report Trip.
- `RideTextarea` — styled multiline input, used on Rate Driver and Report
  Trip.
- `RideAmountChips` — preset ₦ amount chip row, used on Tip Driver.
- `RideDriverIdentity` — gradient-initial avatar + name, with `row`
  (Tip Driver) and `column` (Rate Driver) layout variants matching the
  source's two distinct treatments exactly.
- `RideStarRating` — 5-star tap-to-rate picker, used on Rate Driver.

`RideInfoBox` (Slice 2) gained an additive `success` tone (green,
matching Tip Driver's "100% goes directly to your driver" banner exactly)
alongside its existing `neutral`/`error` tones — the default behavior for
existing callers is unchanged.

WalletPaySuccessScreen's small 2-row detail card and Tip Driver's "Skip,
no tip" link were kept inline rather than folded into `RideDetailCard`/
`RideTextButton`: each has a genuinely distinct radius/font-size/weight
from the closest shared component, and reusing would have silently
changed either screen's actual pixels — same discipline applied to Live
Tracking's badge in Slice 3.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend across three independent
booking→trip→payment round trips: Trip Completed → Payment (wallet,
showing the real ₦5,000 balance) → Wallet Pay Success → Rate Driver
(showing the real driver name "Chidi Eze" from the receipt endpoint) →
Tip Driver; a second run through Trip Completed → Payment → Pay Success →
Trip Receipt (real fare breakdown + driver name) → Report Trip; and a
third through Payment (Cash) → Cash Payment's real waiting state →
a real driver `cash-confirm` API call → Wallet Pay Success. Zero console
errors across all three runs. `GatewayPaymentScreen` (Paystack/
Flutterwave/OPay) was not exercised end-to-end — no real gateway
credentials exist in this sandbox, the same environmental limitation
documented during the Marketplace checkout stabilization pass — but it
composes only already-Verified primitives (`RideHeader`,
`RideStatusBanner`) and is typecheck/lint clean.

This completes all 22 real Ride screens' DPX-100 port except History and
Saved Places (Slice 5).

| Component                      | Status                                       |
| ------------------------------ | -------------------------------------------- |
| `SuperAppRideDetailCard`       | Verified                                     |
| `SuperAppRideReceiptCard`      | Verified                                     |
| `SuperAppRidePaymentSummary`   | Verified                                     |
| `SuperAppRidePaymentMethodRow` | Verified                                     |
| `SuperAppRideOptionRow`        | Verified                                     |
| `SuperAppRideTextarea`         | Verified                                     |
| `SuperAppRideAmountChips`      | Verified                                     |
| `SuperAppRideDriverIdentity`   | Verified                                     |
| `SuperAppRideStarRating`       | Verified                                     |
| `SuperAppRideInfoBox`          | Verified (extended, additive `success` tone) |

## Ride module — Slice 5: History + Saved Places (2026-08-04)

Final slice of the Ride re-platform: presentational markup only, no new
backend work, no behavior change. Ported `RideHistoryScreen` and
`SavedPlacesScreen` (list + add + edit + delete + set-default) off
`ride-ui.tsx` onto `packages/ui`. This completes the DPX-100 port of all
22 real Ride screens.

**New components this slice:**

- `RideSegmentedTabs` — equal-width segmented tab row, generic over the
  tab key type; reused for both History's All/Completed/Cancelled filter
  and Saved Places' Home/Work/Other label picker (identical visual
  pattern in the source, previously duplicated inline in two screens).
- `RideHistoryCard` — a ride-history row (icon, type/date, fare,
  pickup/dropoff dots, optional cancellation note); renders as a button
  when `onClick` is passed (COMPLETED rides only — the receipt endpoint
  404s for any other status) or a static div otherwise, matching the
  source's tappable-vs-static distinction exactly.
- `RidePagination` — the Previous/Page X of Y/Next pager on History.
- `RideTextField` — labeled single-line input, used by the Saved Places
  add/edit form.
- `RidePlaceCard` — a saved-place card (icon, name, default badge,
  address, edit/set-default/delete actions).
- `RideDashedAddButton` — the dashed-border "Add a place" affordance.

The location-status info banner in the add/edit form (radius `xl`/`p-3.5`
vs `RideInfoBox`'s `2xl`/`p-4`) was kept inline rather than force-fit
onto `RideInfoBox`'s `success` tone, since it's a genuinely distinct spec
— same discipline as Slice 3/4.

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend: History's All/Completed/
Cancelled tabs correctly filtered real ride rows (including a real
cancellation-reason note on cancelled rides); tapping a completed ride
opened the real Trip Receipt, and its Back button correctly returned to
History rather than Home, confirming the `returnTo: 'history'` wiring;
Saved Places' list showed the real default Home address; Add a Place
created a real `CustomerAddress` (using real device GPS coordinates, no
geocoding endpoint exists); Edit loaded the real record into the form;
Set as default correctly flipped which place carried the badge; Delete
removed a place — all via real API calls, zero console errors throughout.

| Component                     | Status   |
| ----------------------------- | -------- |
| `SuperAppRideSegmentedTabs`   | Verified |
| `SuperAppRideHistoryCard`     | Verified |
| `SuperAppRidePagination`      | Verified |
| `SuperAppRideTextField`       | Verified |
| `SuperAppRidePlaceCard`       | Verified |
| `SuperAppRideDashedAddButton` | Verified |

## Ride module — Frozen (2026-08-04)

Per founder direction after reviewing `docs/RIDE-DPX-100-PRODUCTION-AUDIT.md`:
the Ride module (all 22 real screens, Slices 1-5, and every `SuperAppRide*`
component listed above) is now **frozen** — bug fixes for verified defects
only. No new Ride features, no UI redesigns, no component refactors,
until the founder explicitly reopens it. This is a stronger commitment
than "Verified": it's not yet formally "Locked" per this document's own
maturity ladder (that still requires an explicit founder pixel-final
sign-off screen by screen), but no further Ride work should happen
without that sign-off or a defect report. See
`docs/DPX-100-MODULE-COMPLETION-GATE.md` for the standard this module met
and that every subsequent module (starting with Wallet) is held to.

## Wallet module — Slice 1: route scaffold + WalletHomeScreen (2026-08-04)

First slice of the Wallet module — a true from-scratch DPX-100 build (no
pre-existing customer-web route, unlike Ride's re-platform). The backend
(`apps/backend/src/wallet/`), SDK (`WalletClient` in
`platform-client.ts`), and shared types (`packages/types`) already existed
in full for balance + transactions, so this slice is real backend
integration from the start, no seed/mock data.

**New components this slice:**

- `SuperAppWalletStatusBar` / `SuperAppWalletBackButton` — Wallet's own
  status bar (full iOS-style icon set, matching `walletScreen.tsx`'s own
  `StatusBar()`) and chevron back button, kept distinct from Ride's and
  Home's own chrome components since the source SVGs differ — same
  no-force-fit discipline as Ride Slice 3.
- `SuperAppWalletBalanceHero` — the hero gradient balance card. `badges`
  is an optional, empty-by-default prop: the Figma source hardcodes
  "PIN Protected" / "Gold Tier" badges, but no PIN or tier system exists
  in the real backend, so no badges render rather than claiming a fake
  capability.
- `SuperAppWalletQuickActionsGrid` — Top Up/Withdraw/Transfer/Pay grid;
  renders an action disabled whenever no `onClick` is supplied.
- `SuperAppWalletRewardsStrip` — cashback summary banner; `onClick` is
  optional and the strip renders non-interactive (no chevron) until the
  Rewards screen exists in Slice 5.
- `SuperAppWalletTransactionRow` / `SuperAppWalletTransactionList` — a
  ledger row and its list wrapper.

**Screen:** `WalletHomeScreen` (`apps/customer-web/src/components/wallet/screens/wallet-home-screen.tsx`),
routed at `/wallet` via `(wallet)/wallet/layout.tsx` + `page.tsx`, mirroring
`(ride)/ride/`'s structure exactly. Wired to real
`sdk.wallet.customerWallet()` (balance) and
`sdk.wallet.customerTransactions({page,pageSize})` (recent ledger, real
`WalletLedgerEntryDto[]` mapped by `.type`/`.direction` via a local
`txVisual()` helper, preferring the real `.description` field — confirmed
rich real descriptions exist, e.g. "Ride fare (rideId)", "Ride tip
(rideId)"). Quick actions all render disabled (Top Up/Withdraw/Transfer/Pay
destinations don't exist until Slices 2-4). The rewards strip only renders
when real CASHBACK entries sum > 0 in the fetched batch, worded as
"cashback in recent activity" (not a lifetime total, since no aggregate
endpoint exists).

**Cross-cutting defect found and fixed:** `DashboardAuthGate`
(`apps/customer-web/src/components/auth/dashboard-auth-gate.tsx`) never
rehydrated `user` after a fresh full-page load. The auth store
deliberately excludes `user` from localStorage persistence (PII), and its
own comment promises rehydration "via /auth/me after login/probe" — but
nothing in the codebase actually called `/auth/me` outside of the login
flow. This meant `user` stayed `null` after any reload of any
dashboard-shell route, silently breaking every screen reading
`user.firstName` (confirmed in both Ride Home and the new Wallet Home,
which fell back to generic greetings instead of the real name). Fixed by
adding an `sdk.auth.me()` rehydration effect to `DashboardAuthGate` — the
one real gate every dashboard-shell route already passes through — scoped
to `customer-web` only (not the shared `@dripplex/hooks` package, which
other portals depend on and weren't audited this session). Verified fix
with Playwright on both Wallet Home (real name now shows) and, as an
explicit regression check since Ride is frozen, Ride Home (still renders
correctly, now also benefiting from the fix).

Typecheck/lint clean across `@dripplex/ui` and `customer-web`. Verified
with Playwright against the real backend: Wallet Home showed the real
balance, real "Last updated" timestamp, real recent transactions with
real descriptions, all four quick actions visibly disabled, and the close
button correctly navigated to `/dashboard`. Zero console errors.

| Component                        | Status   |
| -------------------------------- | -------- |
| `SuperAppWalletStatusBar`        | Verified |
| `SuperAppWalletBackButton`       | Verified |
| `SuperAppWalletBalanceHero`      | Verified |
| `SuperAppWalletQuickActionsGrid` | Verified |
| `SuperAppWalletRewardsStrip`     | Verified |
| `SuperAppWalletTransactionRow`   | Verified |
| `SuperAppWalletTransactionList`  | Verified |

## Wallet module — Slice 2: Transaction History + Transfer + Top Up (2026-08-04)

Per founder direction to build Wallet as a production financial subsystem
(not a demo), this slice connects the three screens the real backend
already substantially supports, closing two small genuine backend gaps
found along the way rather than faking around them, and applies the
newly-adopted DPX-UX-001 (Simplicity First) principle — money-movement
actions get an explicit confirm step, everything else stays low-friction.

**New components this slice:**

- `SuperAppWalletScreenHeader` — back-chevron + bold title header shared
  by every Wallet sub-screen.
- `SuperAppWalletSectionLabel`, `SuperAppWalletSearchInput`,
  `SuperAppWalletFilterPills`, `SuperAppWalletButton` — the wallet source's
  `SectionLabel`/search box/`Pill`/`GreenButton` primitives. `WalletButton`
  is its own component rather than reusing Ride's `SuperAppRideActionButton`
  — visually near-identical (same green-gradient token) but Wallet's own
  spec uses a 14px radius vs Ride's 16px, and Ride is frozen so its button
  can't be generalized without touching frozen code.
- `SuperAppWalletAmountCard`, `SuperAppWalletPresetChips` — the large
  ₦-prefixed amount input and quick-amount chip row (Top Up, Transfer).
- `SuperAppWalletSelectableRow`, `SuperAppWalletRecipientRow` — a
  radio-style row (Top Up's provider list) and an avatar-initials row
  (Transfer's recipient list).
- Reused as-is (genuinely generic, no adaptation needed):
  `SuperAppRidePagination` (Transaction History's pager) and
  `SuperAppRideStatusBanner` (the wallet gateway redirect/verify screen).

**Screens:** `TransactionHistoryScreen` (real paginated ledger with a
server-side `type` filter — added this slice to `WalletHistoryQueryDto` —
mapped to honest tab labels drawn from the real `WalletTransactionType`
enum: All/Top-up/Spending/Transfers/Withdrawals/Refunds/Cashback, not the
Figma source's `Ride`/`Refund`/`Top-up` labels, since the real ledger has
no distinct "ride" transaction type to filter by). `TopUpScreen` (real
`sdk.wallet.fund`/`verifyFunding`, reusing the Ride `GatewayPaymentScreen`
redirect pattern via a new `WalletGatewayPaymentScreen`; provider list
adapted to the three real gateways — Paystack/Flutterwave/Moniepoint — no
saved cards, since no card tokenization exists anywhere in the platform).
`TransferScreen` (real `sdk.wallet.transfer`).

**Real backend gaps found and closed (not faked):** Wallet-to-wallet
Transfer had no way for a customer to resolve a recipient — the Figma
source's "Phone number or @username" search assumes a user directory that
doesn't exist (`UsersController` is `users:read`-gated, admin-only) and
there's no username concept at all. Added the minimum real capability
instead of fabricating a directory search or a fake recents list: a new
`WalletRecipientsService` + two endpoints
(`GET /customer/wallet/transfer/recipients` — exact phone match only,
never a listing/enumeration of users; `GET .../recipients/recent` — real
recent recipients derived from the caller's own past `TRANSFER` ledger
entries' `metadata.toOwnerId`, not stored separately). Both gated by the
existing `customer:wallet:transfer` permission. Full test coverage in
`wallet-recipients.service.spec.ts`.

**DPX-UX-001 applied:** Transfer's Send button doesn't fire immediately —
tapping it flips the CTA into an explicit "Send ₦X to Name?" Confirm/
Cancel step first (money movement always confirms, per the principle's
rule 7), verified via Playwright: Cancel left the balance untouched,
Confirm executed the real transfer. Recipient lookup runs automatically
on a debounced valid-phone-format input rather than requiring a separate
search-button tap (rule 2, reduce taps).

Typecheck/lint clean across `@dripplex/ui`, `customer-web`, and the
backend; backend `wallet`/`wallet-recipients` test suites green (29
tests). Verified end-to-end with Playwright against the real backend
(not mocked): Transaction History showed real grouped-by-date ledger rows
and correctly server-filtered by type; Top Up's confirm correctly
surfaced a real 422 from the payment gateway (no sandbox credentials
configured in this environment — the same documented limitation as
Ride's and Marketplace's gateway paths, not a bug); a full real transfer
was executed twice (via lookup and via recent-recipients) with the
sender's and recipient's real wallet balances confirmed correct via direct
DB query before/after, real ledger entries appearing in both accounts'
Transaction History with the real note text as the entry title; Ride Home
re-verified with no regression (frozen module). Zero console errors
throughout.

| Component                     | Status   |
| ----------------------------- | -------- |
| `SuperAppWalletScreenHeader`  | Verified |
| `SuperAppWalletSectionLabel`  | Verified |
| `SuperAppWalletSearchInput`   | Verified |
| `SuperAppWalletFilterPills`   | Verified |
| `SuperAppWalletButton`        | Verified |
| `SuperAppWalletAmountCard`    | Verified |
| `SuperAppWalletPresetChips`   | Verified |
| `SuperAppWalletSelectableRow` | Verified |
| `SuperAppWalletRecipientRow`  | Verified |

## Ride module — DX rebrand (frozen-module bug fix, 2026-08-04)

Founder-granted exception to the Ride freeze: not a redesign, a real
defect fix. Ride-type display names were hardcoded per-screen
(`Record<string,string>` label maps duplicated in the Fare Estimate,
History, and Trip Completed screens, e.g. `ECONOMY: 'Economy'`) instead
of backend-driven — the same class of defect the founder's instruction
named directly. Fixed by adding a real backend catalog
(`RIDE_TYPE_CATALOG` in `apps/backend/src/rides/ride.constants.ts`,
exposed via `GET /customer/rides/types`) and having all three screens
fetch it (`useRideTypeCatalog()`) instead of hardcoding labels. No visual
redesign — `SuperAppRideTypeSelector` (used by the Fare Estimate chip
row) was already a fully generic, options-driven component requiring no
changes; it now just receives real data instead of a hardcoded array.

Per founder direction, three customer-facing categories now launch
alongside the pre-existing Tricycle vehicle class: **Dx Ride** (the
renamed Economy default), **Dx Comfort**, **Dx XL** — added as new
`RideType` Prisma enum values (`ALTER TYPE ... ADD VALUE`, additive and
backward-compatible) with placeholder fare rates in `RIDE_FARE_RATES`
(same "not founder-approved economics" caveat already on the existing
Economy/Tricycle rates). Brand casing is "Dx" (capital D, lowercase x);
Tricycle is not Dx-branded and stays plain "Tricycle". Driver-portal's
own local vehicle-type label maps (online toggle, incoming-ride modal,
profile page) were extended with the two new options too — without this,
no driver could ever register as Comfort/XL and the categories would be
unbookable in practice; this stays a local label map, not backend-driven,
since driver-portal wasn't named in the founder's instruction and a
driver-facing catalog endpoint is a larger scope than this fix.

Typecheck/lint clean across `@dripplex/backend`, `@dripplex/types`,
`@dripplex/sdk`, `customer-web`, and `driver-portal`. Backend `rides` and
`promotions` suites green (one `ride-payment.service.spec.ts` failure seen
only when run as part of the full `rides` suite, not in isolation —
pre-existing shared-dev-DB cross-file state pollution, not caused by this
change; passes standalone). Verified with Playwright against the real
backend: Fare Estimate's chip row shows real "Dx Ride / Dx Comfort /
Dx XL / Tricycle" with real emoji from the catalog; selecting Dx
Comfort produced a real fare estimate using the new COMFORT rate (₦450
base) and a real "Book Dx Comfort · ₦3,186" button label; Ride History
showed "Dx Ride" (previously "economy Ride", lowercase, from the old
`.toLowerCase()` hack) on every existing ride row. Zero console errors.
Ride's frozen visual spec is otherwise untouched.

**Casing correction (2026-08-04, same day):** founder corrected the brand
casing to "Dx" (capital D, lowercase x, not "DX") and clarified Tricycle
should not carry the Dx prefix at all. Both fixed across
`RIDE_TYPE_CATALOG` and the three driver-portal label maps; re-verified
with Playwright, zero console errors, no other behavior changed.

## Wallet module — Slice 3: Payment Methods + Rewards (2026-08-04)

Figma's Payment Methods and Rewards screens both assume backend concepts
that don't exist (saved/tokenized cards, linked bank accounts, a fixed
reward-category taxonomy) — but researching the real backend for this
slice found it already supports almost everything else these screens
need for real: a full loyalty tier system and a full customer referral
system, neither previously wired to any customer-web UI. Built to
maximize real data rather than defaulting to a stripped-down adaptation,
adapting only the parts genuinely missing.

**Real backend/SDK defect found and fixed:** `LoyaltyClient.account()`
in `@dripplex/sdk` was typed and parsed as if `GET /customer/loyalty`
returned a `LoyaltyAccountDto` directly. It doesn't — the real controller
returns a wrapper, `{ account, nextTier, achievements }`. This was a
genuinely broken, already-shipped bug: the one existing caller
(`customer-backend-status.tsx`'s debug widget) was reading
`account.pointsBalance` directly off the wrapper, which is always
`undefined` at runtime. Fixed across `packages/types`
(`LoyaltyAccountOverviewDto` + supporting types), `packages/sdk`
(`account()`/`redeem()` now return the correct wrapper type; added
`history()` for the ledger endpoint), and the one real caller.

**New components this slice:** `SuperAppWalletRewardsHero` — a
green-gradient hero distinct from `SuperAppWalletBalanceHero` (different
gradient stops, single top-right glow, an optional nested tier-progress
subcomponent) rather than a forced reuse, since the two cards' content
shapes genuinely differ (total cashback + tier progress vs. spendable
balance). `SuperAppWalletReferralCard` — gold-accented code display with
a Copy Code button. Reused as-is: `SuperAppWalletTransactionList/Row`
for the cashback ledger, `SuperAppWalletSelectableRow`/`SectionLabel`/
`ScreenHeader` across both new screens.

**Rewards screen:** real loyalty tier (`GET /customer/loyalty`, BRONZE
through VIP), a real flat list of CASHBACK ledger entries (Figma's three
fixed categories — Ride Cashback/Referral Bonus/Welcome Bonus with
hardcoded amounts — have no backend counterpart; cashback carries no
source taxonomy beyond its real description text, so the breakdown is
the real ledger, not invented buckets), and a real referral code
(`GET /customer/referrals/me`, get-or-create) with copy-to-clipboard and
real stats (`GET /customer/referrals/stats`, including a new
`refereeRewardAmount` field added to the DTO this slice so the "your
friend earns ₦X" copy reads from `REFERRAL_REWARD_AMOUNTS` instead of
being hardcoded in the frontend). Tier-progress percentage is a
documented, defensible derived ratio (`lifetimePoints / (lifetimePoints +
nextTier.pointsRequired) * 100`) rather than a hardcoded copy of
`LOYALTY_TIER_THRESHOLDS` on the frontend — the backend only exposes the
delta to the next tier, not the current tier's own lower bound, so an
exact "% within this tier's band" isn't computable from the real API
surface without duplicating backend-owned constants client-side. The
exact real "X points more to reach Y" figure is always shown alongside
the percentage so the honest number is never hidden behind an
approximation.

**Payment Methods screen:** the three real wallet-funding gateways
(Paystack/Flutterwave/Moniepoint — the same three Top Up already uses)
shown as reference info, plus an honest "No linked bank accounts yet.
You'll be able to add one when withdrawing from your wallet." empty
state — no fake "add card" flow, since no card tokenization exists
anywhere in the platform and bank-account linking becomes real in
Slice 4 (Withdraw). Reached via a new "Manage" link on Top Up's payment
provider section, per DPX-UX-001 (a related action surfaced in place
rather than requiring separate navigation).

**Wiring:** Wallet Home's rewards strip (previously non-interactive) now
navigates to Rewards; it stays hidden when the fetched recent-transactions
batch has no CASHBACK entries, rather than showing a misleading ₦0 strip.

Typecheck/lint clean across `@dripplex/types`, `@dripplex/sdk`,
`@dripplex/ui`, `customer-web`, and the backend. Backend `loyalty`/
`referrals`/`wallet` suites green (114 tests, including the
`refereeRewardAmount` addition and the referrals stats test update).
Verified end-to-end with Playwright against the real backend: seeded two
real cashback credits via the actual `WalletService.cashback()` code
path (not fabricated rows) to exercise the non-empty states, then
confirmed the Rewards screen showed the real ₦225 total, real "Bronze →
Silver, 13%, 875 points more to reach Silver" tier progress, the real
two-entry cashback ledger, and a real referral code with a working
Copy Code → "Copied!" state; confirmed Wallet Home's rewards strip
appeared with the correct real sum and navigated to Rewards; confirmed
Top Up's Manage link opened Payment Methods showing the three real
gateways and the honest empty bank-account state. Zero console errors
throughout.

| Component                    | Status   |
| ---------------------------- | -------- |
| `SuperAppWalletRewardsHero`  | Verified |
| `SuperAppWalletReferralCard` | Verified |

## Wallet module — Slice 4: Withdraw (2026-08-04)

A real production module, not a demo — written from a design note first
(`docs/WALLET-004-WITHDRAW-DESIGN.md`), same "design note before code"
discipline as RIDE-002.7. No new packages/ui components needed — the whole
flow (Withdraw, Add Bank Account, Set PIN) is built entirely from Slice 2/3
primitives (`SuperAppWalletAmountCard`, `SuperAppWalletSelectableRow`,
`SuperAppWalletScreenHeader`, `SuperAppWalletSectionLabel`,
`SuperAppWalletButton`), confirming they were already generic enough to
cover a fourth money-movement flow without modification.

**What's real:** three new backend models (`CustomerBankAccount`,
`WalletPin`, `WithdrawalRequest` + `WithdrawalRequestStatus`), a real
bcrypt-hashed 4-digit PIN gate (no PIN infrastructure existed anywhere in
the platform before this), and a real debit-at-request-creation flow using
`WalletService.withdrawal()` — the wallet is debited the moment a
withdrawal is submitted, not when it's fulfilled, matching real bank-
transfer UX and preventing double-spend while a request is pending. No
automated payout provider exists yet (confirmed in the original RIDE-002.7
audit and re-confirmed here), so Phase 1 ships a **real admin
manual-completion queue** (`AdminWithdrawalController`: list pending,
complete with a note, or fail with a reason that reverses the debit via a
real `WalletService.credit()` call) — the same way early-stage Nigerian
fintechs actually operate before payout-API automation goes live. This is
a real, usable feature end-to-end in this environment, not a stub that
silently does nothing.

**Phase 2** adds the `PayoutProvider` interface
(`wallet/payout/payout-provider.adapter.ts`) and a `PaystackTransferProvider`
stub, following the exact `MoniepointProvider`/`OpayProvider` precedent
from the payments module: a real class, real DI wiring, real method
signatures, throwing `NotImplementedException` until real transfer-API
credentials are configured. `WithdrawalService` does not call it yet —
Phase 1's admin queue remains the real fulfillment path.

**Bank accounts are self-attested** (no bank-account-verification API is
integrated anywhere in the platform — the same trust level merchant
`BankAccount` already operates at in production), documented as a known
limitation rather than hidden.

**Screens:** `WithdrawScreen` (balance hint, amount card, bank-account
selector, gated on two real prerequisites — a linked bank account and a
set PIN — surfaced as inline CTAs rather than silently disabling the
screen). `AddBankAccountScreen` and `SetWalletPinScreen` (per DPX-UX-001,
setting a PIN for the first time is the one step that gets its own short
screen rather than folding into the confirm step, since a PIN is being
created, not just checked). Per DPX-UX-001, entering an amount and
picking a bank account doesn't withdraw anything until an explicit
"Confirm withdrawal" step, with PIN entry folded into that same confirm
surface — one confirmation step, not two, matching Transfer's established
confirm-step pattern from Slice 2.

Typecheck/lint clean across `@dripplex/backend`, `@dripplex/types`,
`@dripplex/sdk`, and `customer-web`. New unit tests for
`BankAccountsService`, `WalletPinService`, and `WithdrawalService` (26
tests, covering default-account reassignment on removal, PIN-set
conflict/validation, insufficient-balance failure marking the request
FAILED, and the admin complete/fail paths). Full backend suite: 1050/1052
passing (the 2 failures are the same pre-existing shared-dev-DB
`customer-products.service.spec.ts` pollution documented in earlier
slices, unrelated to this change). Verified end-to-end with Playwright
against the real backend: the full first-time flow (no bank account → Add
Bank Account → no PIN → Set PIN → enter amount → select account → Confirm
with PIN) completed with zero console errors, and the wallet's real balance
moved from ₦4,350.00 to ₦3,850.00 on confirm — an exact real debit, not a
simulated one. The admin fulfillment path was verified directly against
the real database (not mocked): `adminComplete` left the balance
untouched (money already moved at request time); a second withdrawal's
`adminFail` correctly reversed the debit, restoring the exact amount.

| Component              | Status   |
| ---------------------- | -------- |
| `WithdrawScreen`       | Verified |
| `AddBankAccountScreen` | Verified |
| `SetWalletPinScreen`   | Verified |

**Gateway-partner correction (2026-08-04, same day):** founder corrected
the platform's real third payment-gateway partner — it's **OPay**, not
Moniepoint, which is not a real gateway partner for this platform.
Moniepoint had been listed as a selectable option in Top Up
(`top-up-screen.tsx`) and Payment Methods (`payment-methods-screen.tsx`),
carried forward from Slice 2/3's provider list, which predated the
founder's OPay-vs-Moniepoint clarification (already applied correctly to
Ride payments earlier in the program). Both screens now list
Paystack/Flutterwave/OPay. Fixing this also surfaced a real pre-existing
backend defect: Marketplace Checkout's frontend already offered OPay as a
selectable option, but `PaymentProviderDtoEnum` and
`PaymentService.resolveProvider()` only accepted
`PAYSTACK | FLUTTERWAVE | MONIEPOINT`, so selecting OPay at checkout would
have thrown "Unsupported payment provider: OPAY" — now fixed alongside the
UI correction. `WalletFundingProviderDto` / `WalletFundingService` /
`WalletFundingProvider` (the wallet top-up provider type) received the
same swap. The Prisma `PaymentProvider` enum keeps all four values
(`PAYSTACK`/`FLUTTERWAVE`/`MONIEPOINT`/`OPAY`) — no destructive migration —
and the `MoniepointProvider` stub class is left in place, unreachable,
mirroring the precedent `OpayProvider` set before this fix. The historical
narrative above (Slice 2/3 sections) describes what was actually shipped
at the time and is left as-is rather than rewritten; this note records the
correction. Re-verified with Playwright: Top Up and Payment Methods show
OPay in place of Moniepoint, and Marketplace Checkout offers exactly three
gateways (Paystack/Flutterwave/OPay) with zero console errors.

## Marketplace module — Checkout: Cash-on-Delivery + Dx Wallet payment (2026-08-04)

Founder asked why Checkout didn't offer Cash and Dx Wallet the way Ride
already does. It's a real, buildable feature — `WalletService.debit()` is
the same primitive Ride's wallet-pay path already calls, and
Cash-on-Delivery needed the same driver-confirmation pattern
`RidePaymentService.confirmCash()` already proved, adapted to a delivery
rider collecting cash at handoff instead of a driver. See
docs/MARKETPLACE-006-CASH-WALLET-PAYMENT-DESIGN.md for the full design.

New `OrderPaymentMethod` Prisma enum (mirrors `RidePaymentMethod`,
deliberately kept separate from the gateway-only `PaymentProvider` enum)
plus `Order.paymentMethod`. `PaymentService.initializePayment()` branches
on it exactly like Ride: WALLET debits the wallet and confirms the order
immediately (`paymentStatus: PAID`); CASH (delivery orders only — no
merchant-side "confirm handoff" action exists for pickup orders, a real,
documented product constraint, not a workaround) confirms the order for
the merchant to prepare but leaves `paymentStatus: PENDING` until the
delivery rider completes the handoff. Settlement is wired through a new
`CashSettlementSubscriber` listening for `DELIVERY_COMPLETED` — avoids a
circular module dependency the same way `delivery/order-ready.subscriber.ts`
already does in the other direction. Checkout's payment selector gains a
balance-aware, disable-when-insufficient Dx Wallet row (mirroring Ride's
`payment-screen.tsx`) and a Cash on Delivery row shown only for delivery
orders; the tracking screen gains a "Cash on Delivery — have ₦X ready"
banner for pending-cash orders.

**Known gap, documented not hidden:** cash settlement is real and
callable (verified directly, same as every other backend capability that
ships ahead of its UI in this program), but no rider-facing frontend
exists anywhere in the platform yet (`rider-portal` is an empty app
shell) — a pre-existing gap this task doesn't attempt to backfill.

Typecheck/lint clean across `@dripplex/backend`, `@dripplex/types`,
`@dripplex/sdk`, `@dripplex/ui`, and `customer-web`. New unit tests for
the WALLET/CASH branches of `PaymentService` and for
`CashSettlementSubscriber` (11 tests). Full backend suite: 1061/1063
passing (the 2 failures are the same pre-existing shared-dev-DB
`customer-products.service.spec.ts` pollution documented in earlier
slices, unrelated to this change). Verified end-to-end with Playwright
against the real backend: a real ₦10,000 wallet-funded customer selected
Dx Wallet at checkout, saw their real balance, placed a real order that
came back `CONFIRMED`/`PAID`/`paymentMethod: WALLET`, and the wallet's
real balance dropped by the exact debited amount; a second order with
Cash on Delivery came back `CONFIRMED`/`PENDING`/`paymentMethod: CASH`
and the tracking screen showed the cash-due banner; switching fulfillment
to Pickup correctly hid the Cash option while keeping Dx Wallet. Zero
console errors across all three flows.

**Real defect discovered during verification, out of scope for this
task:** the wallet-debited/order-charged total didn't match the
Final Total shown at checkout (e.g. displayed ₦7,090 including ₦1,500
delivery fee + ₦390 tax; actually charged ₦5,200) — `checkout.service.ts`
uses `ZeroDeliveryCalculator`/`ZeroTaxCalculator` (both permanent stubs,
"no delivery fee / tax until rules are configured") when creating the
order, while the Cart's totals shown at checkout use a _different_,
non-zero `DeliveryFeeCalculator`. This predates this change — it would
affect every payment method, including the existing gateway flows — and
isn't specific to Cash/Wallet. Flagged to the founder rather than fixed
here, since reconciling the two pricing paths is a separate, non-trivial
change outside a payment-methods task's scope.
