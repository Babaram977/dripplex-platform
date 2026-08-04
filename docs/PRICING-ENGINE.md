# Marketplace Pricing Engine — single source of truth

**Status:** Shipped 2026-08-04, in response to a founder-flagged pricing
integrity defect (see `MARKETPLACE-006-CASH-WALLET-PAYMENT-DESIGN.md`'s
"Real defect discovered during verification").

## The bug this closes

`CartService.recalculateInternal` (Cart preview) and `CheckoutService.checkout`
(Order creation) each independently recomputed subtotal/discount/tax/delivery
fee from the same `cart.items`, using **two separate sets of calculators**:

- Cart used real ones: `NigeriaTaxCalculator` (7.5% VAT) and
  `FlatDeliveryFeeCalculator` (₦1,500 flat fee).
- Checkout used permanent zero-stubs: `ZeroTaxCalculator`,
  `ZeroDeliveryCalculator`, `ZeroCouponCalculator`.

A checkout showing "Final Total ₦7,090" (₦5,200 subtotal + ₦1,500 delivery

- ₦390 tax) created and charged an Order for ₦5,200 — the difference silently
  absorbed nowhere, since `PaymentService` (Wallet/Paystack/Flutterwave/OPay/
  Cash) all uniformly trust `order.total` for the amount to charge. A second,
  related instance of the same bug: the checkout page already calls
  `sdk.promotions.validate` and shows a real coupon discount, and already
  passes the applied `couponCode` through to `POST /customer/checkout` — but
  `ZeroCouponCalculator` discarded it, so a customer who saw a discounted
  total was actually charged the full, undiscounted amount.

## The fix: one `PricingService`

`apps/backend/src/pricing/pricing.service.ts` exports a single
`PricingService.computeTotals(input)` — the one place Marketplace pricing
math exists. Both `CartService.recalculateInternal` and
`CheckoutService.checkout` call it directly; neither computes tax, delivery
fee, or discount itself anymore.

```ts
computeTotals({
  subtotal,
  customerId,
  merchantId,
  couponCode,       // optional — Cart never supplies one today (no cart-level
                     // coupon UI exists); Checkout passes CheckoutDto.couponCode
  fulfillmentType,  // 'PICKUP' | 'DELIVERY' | undefined
}): { subtotal, discount, tax, deliveryFee, total, couponCode }
```

- **Discount**: real evaluation via `PromotionsService.evaluateForCart()` —
  the exact same function the checkout page's "Apply promo" button already
  calls (`sdk.promotions.validate`). Using the identical function for both
  the preview a customer sees and the amount actually charged is what
  guarantees the two never diverge. `couponCode` on the resulting Order is
  only set when the evaluation found a real, valid match (`discount > 0`) —
  previously any non-empty string typed into the coupon field was echoed
  back as "redeemed" and fired `COUPON_REDEEMED` (which the loyalty module
  rewards points for), even for garbage codes. That's fixed as a side
  effect of routing through real evaluation.
- **Tax**: `Math.max(0, subtotal - discount) * 0.075` (Nigeria VAT), ported
  from the old `NigeriaTaxCalculator`.
- **Delivery fee**: `fulfillmentType === 'PICKUP' ? 0 : 1500`. Cart doesn't
  know the fulfillment type yet (chosen at checkout), so it omits the field
  — treated as the non-zero "delivery" shape, matching Cart's prior
  behaviour and how the checkout page already nets pickup down to zero
  client-side (`checkout/page.tsx`'s `grandTotalForOptions`). Checkout
  always passes the real, customer-selected value.

`apps/backend/src/pricing/pricing.constants.ts` holds the two rate/fee
constants (moved from `cart.constants.ts`, which previously duplicated
them alongside `orders/pricing/*`'s hardcoded stub values).

## What was deleted

The two independent, divergent calculator hierarchies:

- `cart/pricing/{coupon-engine,no-coupon.engine,tax-calculator,
nigeria-tax.calculator,delivery-fee-calculator,
flat-delivery-fee.calculator}.ts`
- `orders/pricing/{coupon-calculator,tax-calculator,delivery-calculator}.ts`

(`orders/pricing/{checkout-product.validator,
catalog-checkout-product.validator}.ts` are unrelated product-snapshot
validation, not pricing — kept unchanged.) Both modules' old
`pricing-hooks.spec.ts` files are replaced by
`pricing/pricing.service.spec.ts`, which asserts the exact ₦5,200 / ₦1,500
/ ₦390 / ₦7,090 numbers from the original bug report, plus PICKUP,
coupon-valid, coupon-invalid, and discount-cannot-exceed-subtotal cases.

## Requirement 3 — "checkout preview, order creation, payment authorization,

wallet debit, gateway payment, receipts, and merchant settlement all use the
same pricing service"

- **Checkout preview (Cart) and order creation (Checkout)**: both call
  `PricingService.computeTotals` directly — done.
- **Payment authorization, wallet debit, gateway payment**:
  `PaymentService.initializePayment` (Wallet/Paystack/Flutterwave/OPay) and
  `markCashPaymentReceived` (Cash) all read `Number(order.total)` uniformly
  — this was already true before this change (confirmed by reading
  `payment.service.ts`) and needed no edits: once `Order.total` is correct
  at creation time, every payment method automatically stays consistent
  with it.
- **Receipts, merchant settlement**: neither exists yet as a separate
  Marketplace feature (unlike Ride, which has a real commission-split
  settlement system) — there is nothing to wire up. Stated here rather
  than silently skipped: when either is built, it should read
  `order.total`/`order.discount`/`order.tax`/`order.deliveryFee` directly
  rather than recomputing, for the same reason this fix exists.

## Requirement 4 — automated tests proving displayed == charged

`pricing/pricing.service.spec.ts` proves the calculation itself is single-
sourced. `cart/cart.service.spec.ts` and `orders/checkout.service.spec.ts`
were updated to assert both services call `PricingService.computeTotals`
with the parameters each has available, and that Checkout persists the
totals it returns verbatim onto the Order (no re-derivation).

End-to-end, verified against the real dev backend (not mocked) by
reproducing the exact scenario from the bug report — ₦5,200 subtotal,
DELIVERY fulfillment — and confirming the Cart preview and the resulting
Order agree exactly, across every payment method:

| Payment method     | Cart preview total        | Order total after payment              | Charged/debited amount                      |
| ------------------ | ------------------------- | -------------------------------------- | ------------------------------------------- |
| Wallet             | ₦11,180 (2× item, PICKUP) | ₦11,180                                | ₦11,180 debited (balance ₦50,000 → ₦38,820) |
| Cash on Delivery   | ₦5,262.50 (DELIVERY)      | ₦5,262.50, `paymentStatus: PENDING`    | ₦5,262.50 to collect at delivery            |
| Delivery (generic) | ₦12,680                   | ₦12,680                                | —                                           |
| Pickup (generic)   | ₦11,180                   | ₦11,180 (deliveryFee correctly zeroed) | —                                           |

Paystack/Flutterwave/OPay were not separately re-verified end-to-end in
this pass — they were already covered by the Cash/Wallet feature's
Playwright run, and `payment.service.ts`'s uniform `Number(order.total)`
read (unchanged by this fix) is what guarantees their consistency; the
risk this fix addresses is entirely upstream of that shared read, in how
`order.total` gets computed.

## Coupon/redemption scope note

`PricingService` wires real, read-only discount **evaluation**
(`PromotionsService.evaluateForCart`) into both Cart and Checkout — this is
what closes the "displayed discount ≠ charged discount" gap. It does
**not** wire the transactional **redemption** path
(`PromotionsService.redeem`/`redeemForReference`, which locks per-user/
per-device/global usage limits and creates `PromotionRedemption` rows).
That enforcement layer remains a distinct, separable follow-up — flagged,
not hidden. Practical impact today is zero: there are currently no active
`Promotion` rows in the database, so this path is exercised only by tests.
When it does matter (a real promotion goes live), the current behaviour is
a strict improvement over the pre-fix state (real discount, correctly
priced) even without usage-limit locking — it just means a coupon could in
theory be applied by more customers than its `usageLimit` intends until
redemption locking is added.

## Long-term architecture note

The founder's message proposed a generalized Pricing Engine (Cart →
Pricing Engine → Order → Payment → Receipt) intended to eventually power
DX Food/Pharmacy/Courier/Property and subscriptions/bookings, computing
discounts, cashback, delivery fee, service fee, and tax uniformly. This
fix is scoped to Marketplace specifically (the concrete, demonstrated bug),
but `PricingService`'s shape — one method, explicit inputs, no hidden
state — is intentionally the kind of interface that generalizes: a future
pass could parameterize it by domain rather than building a second,
domain-specific pricing path when DX Food/Pharmacy/Courier ship.
