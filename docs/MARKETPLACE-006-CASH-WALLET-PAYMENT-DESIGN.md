# Marketplace: Cash-on-Delivery + Dx Wallet Payment — Design

**Status:** Locked before implementation, 2026-08-04.

## Why

Marketplace Checkout only offered Paystack/Flutterwave/OPay. Ride payments
already support `WALLET` and `CASH` for real (`RidePaymentMethod`,
`RidePaymentService`), proven end-to-end. Founder asked why Marketplace
doesn't have the same — it's a real, buildable feature (not a backend
gap): `WalletService.debit()` is a reusable primitive Ride already calls,
and Cash-on-Delivery just needs the same driver/rider-confirmation pattern
adapted to a merchant/customer handoff. This closes that gap, following
the exact precedent Ride already established rather than inventing a new
pattern.

## Schema

New `OrderPaymentMethod` enum, mirroring `RidePaymentMethod` exactly:

```prisma
enum OrderPaymentMethod {
  PAYSTACK
  FLUTTERWAVE
  OPAY
  WALLET
  CASH
}
```

`Order.paymentMethod OrderPaymentMethod?` (nullable — unset until a method
is chosen, mirrors `Ride.paymentMethod`). `PaymentTransaction.provider`
(the existing `PaymentProvider` enum: PAYSTACK/FLUTTERWAVE/MONIEPOINT/OPAY)
is untouched — WALLET and CASH never create a `PaymentTransaction` row,
exactly like Ride never creates a `RidePaymentTransaction` row for its
WALLET/CASH fares. This keeps "provider" meaning "external gateway" and
"payment method" meaning "how the customer chose to pay" as two distinct,
non-overloaded concepts — the same separation Ride already relies on.

## Backend flow

`PaymentService.initializePayment()` branches on the resolved
`OrderPaymentMethod`, exactly like `RidePaymentService.initiatePayment()`:

- **WALLET** → `payOrderWithWallet()`: debits the customer's wallet for
  `order.total` via `WalletService.debit()` (reference type
  `order_payment`, reference id = order id — new constant in
  `order.constants.ts`, alongside the existing `order_refund` one). On
  success, the order is immediately finalized: `status → CONFIRMED`,
  `paymentStatus → PAID`, `paymentMethod → WALLET`, inventory deducted,
  cart marked checked-out — reusing the same finalization logic the
  gateway path already runs, extracted into a shared
  `finalizeOrderConfirmation()` so both paths stay identical apart from
  the payment-status outcome. If the debit throws (insufficient balance),
  the order stays PENDING/unpaid and the error surfaces as-is — same
  behavior as a failed gateway payment.

- **CASH** → `selectCashOnDelivery()`: only valid for `fulfillmentType:
DELIVERY` (see "Why pickup is out of scope" below). Sets
  `paymentMethod → CASH` and runs the same finalization as WALLET
  (`status → CONFIRMED`, inventory deducted, cart checked-out) but leaves
  `paymentStatus: PENDING` — the merchant starts preparing immediately
  (standard COD behavior everywhere), payment is collected physically at
  delivery.

- **PAYSTACK / FLUTTERWAVE / OPAY** → unchanged gateway flow (mapped to
  the existing `PaymentProvider` adapters exactly as before).

`InitializePaymentResponseDto` is widened to make `authorizationUrl`,
`reference`, and `transaction` optional, and gains `order: OrderDto` —
mirroring `InitiateRidePaymentResponse { ride, authorizationUrl?,
reference? }` exactly. The frontend checks `result.authorizationUrl` first
(gateway redirect), then `result.order.paymentStatus === 'PAID'` (wallet —
already done), else treats it as cash-pending — the same three-way branch
`payment-screen.tsx` already uses for Ride.

## Cash confirmation authority

Mirrors Ride's `confirmCash()` being driver-only, never customer-callable
(a customer can't self-mark their own cash payment as received — that's
the same fraud gap Ride avoided). For Marketplace, the analogous physical
handoff is the delivery rider's `deliver()` action
(`rider-delivery.controller.ts` → `DeliveryService.deliver()`), which
already emits `DOMAIN_EVENTS.DELIVERY_COMPLETED`. Rather than
`DeliveryService` calling `PaymentService` directly (which would make
`DeliveryModule` depend on `PaymentsModule`, on top of the existing
`PaymentsModule` → `DeliveryModule` import — a cycle), a new
`CashSettlementSubscriber` in the payments module listens for
`DELIVERY_COMPLETED` and calls `PaymentService.markCashPaymentReceived()`,
mirroring the exact same problem `delivery/order-ready.subscriber.ts`
already solves in the other direction (`OrdersModule` → `DeliveryModule`
avoided the same way). `markCashPaymentReceived()` is a deliberate no-op
for the common non-cash case — every delivery completion fires the event,
regardless of how the order was paid.

**Known gap, documented not hidden:** there is currently no rider-facing
frontend anywhere in the platform (`rider-portal` exists as an app shell
but nothing calls the delivery endpoints from any app yet) — this predates
this change and isn't something Marketplace-checkout work should try to
backfill. The confirm-cash behavior described above is real and callable
(verified via direct API calls, same as every other backend capability
that ships ahead of its UI in this program), but a human rider cannot yet
trigger it from a screen. This is the same category of gap already
documented for Withdraw's Phase 2 payout provider — a real capability
without a UI, not a fake one.

## Why pickup is out of scope for Cash

Delivery orders have a clear cash-collection moment (the rider handoff).
Pickup orders don't: the merchant marks `READY` and the customer collects
in-store, but there is no "confirm handoff" merchant action beyond
`READY` today, and building one would mean touching `merchant-portal`'s
order UI — a different app, out of scope for a checkout-payment-options
task. Restricting Cash to `DELIVERY` fulfillment is a legitimate, common
product constraint (many delivery apps do exactly this), not a
workaround. Documented here rather than silently gated.

## Frontend

- `checkout/page.tsx`: `PAYMENT_OPTIONS` gains `WALLET` (label "Dx
  Wallet", balance-aware subtitle + disabled-when-insufficient, mirroring
  `payment-screen.tsx`'s Ride wallet row) and `CASH` (label "Cash on
  Delivery", shown only when `fulfillmentType === 'DELIVERY'`).
  `onPlaceOrder()` branches exactly like Ride's `PaymentScreen`: redirect
  if `authorizationUrl`, else route to tracking (paid immediately for
  WALLET, pending-cash for CASH — the tracking page already handles a
  PENDING order gracefully, gains a small "Cash on Delivery" banner).
- `SuperAppPaymentMethodSelector` (packages/ui): gains an optional
  `disabled` per-option flag (mirrors `SuperAppRidePaymentMethodRow`),
  needed for the insufficient-wallet-balance case.

## Real defect discovered during verification (not fixed here)

Verifying the WALLET flow end-to-end surfaced a pre-existing pricing
inconsistency: the Cart's totals shown at checkout use a real, non-zero
`DeliveryFeeCalculator`, but `checkout.service.ts` creates the actual
`Order` using `ZeroDeliveryCalculator`/`ZeroTaxCalculator` (permanent
stubs — "no delivery fee / tax until rules are configured"). A checkout
showing "Final Total ₦7,090" (₦5,200 subtotal + ₦1,500 delivery + ₦390
tax) actually creates and charges an order for ₦5,200. This affects every
payment method — gateway, wallet, and cash alike — and predates this
change; it is not specific to Cash/Wallet. Flagged to the founder rather
than fixed here, since reconciling the two pricing paths is a separate,
non-trivial change outside this task's scope.

## What stays unchanged

The Prisma `PaymentProvider` enum, `PaymentProviderAdapter` interface,
gateway adapters, webhook handling, admin refund flow — none of this
changes. Refunds for WALLET/CASH-paid orders still go through
`PaymentService.refundOrder()` → `WalletService.refund()` unchanged (a
cash-paid order can still be refunded to the customer's wallet if needed,
same as today).
