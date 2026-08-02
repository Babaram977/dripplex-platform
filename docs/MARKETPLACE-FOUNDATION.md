# DPX-CORE-003 — Marketplace & Commerce Foundation

Status as of 2026-08-02: items **#1 Universal Order State Machine** and
**#2 Merchant Operations Platform** are complete. This document covers those
two; items #3–#10 (multi-branch merchants, inventory hardening, merchant
promotions, checkout completion, merchant analytics, SDK completion,
verification, and final docs) are tracked separately and not yet built.

## Why this exists

An audit of the repository at the start of this work found ~90% of the
originally-proposed 20-module marketplace spec already built (merchants,
products, cart, checkout, payments, reviews, search, wishlist, delivery).
The real gaps were: no universal order lifecycle beyond a coarse
create → pay → deliver flow, and no merchant-facing way to accept, prepare,
or reject an order. This doc covers the two pieces built to close those gaps,
designed as the shared engine every future vertical (food, grocery, pharmacy,
logistics) extends rather than re-implements.

## 1. Universal Order State Machine

### Status enum

`OrderStatus`: `DRAFT, PENDING, CONFIRMED, PREPARING, READY,
DRIVER_ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED,
REFUNDED, DISPUTED, FAILED` (`FAILED` is legacy — kept only because Postgres
can't drop enum values without a full type rebuild; new code never sets it,
its semantics are covered by `CANCELLED` + `PaymentStatus.FAILED`).

`PaymentStatus` (`PENDING/PAID/FAILED/REFUNDED`) stays orthogonal to
`OrderStatus` — mirrors the Ride module's existing
`RideStatus`/`RidePaymentStatus` split already established in this codebase.

Renamed in place (old → new), safe because zero real Order/Cart production
data existed at migration time (verified against `RELEASE-HISTORY.md`):
`PENDING_PAYMENT`→`PENDING`, `PAID`→`CONFIRMED`, `PROCESSING`→`PREPARING`,
`READY_FOR_PICKUP`→`READY`, `OUT_FOR_DELIVERY`→`IN_TRANSIT`.

### Repository shape

A single `OrdersRepository.transition(id, input: OrderTransitionInput)`
replaced four narrow methods (`updateStatus`/`cancelOrder`/`markFailed`/
`markPaid`). Every status change — accept, ready, deliver, cancel, refund —
sets `status` plus whichever milestone timestamp/cancellation metadata
applies, instead of one repository method per transition.

### New models

- **`OrderDispute`** — mirrors the pre-existing `RideProblemReport` shape
  deliberately (`id, orderId, raisedBy, reason, status, resolution,
resolvedBy, createdAt, resolvedAt`). Minimal by design: no photo evidence
  or moderation queue, matching this codebase's "document honestly rather
  than invent unsupported behavior" convention.
- **`StockMovement`** — closes the `CAT-003` backlog item from the original
  catalog build (inventory audit trail). Schema exists; the write path
  (auto-recording movements on reservation/deduction/restock) is scoped to
  DPX-CORE-003 #4 (Inventory Engine Hardening), not yet built.

### Design decisions

- **Delivery dispatch moved from payment-success to merchant-ready.**
  Previously a `DeliveryJob` was created the instant payment succeeded. Now
  it's created when the merchant marks the order `READY` — a real-world
  food-delivery pattern (a rider shouldn't be dispatched before food is
  ready). Implemented via a domain-event subscriber
  (`OrderReadySubscriber` in `delivery/`) listening for `ORDER_READY`,
  rather than a direct service call, specifically to avoid a circular
  module dependency (`DeliveryModule` already imports `OrdersModule` for
  `ORDERS_REPOSITORY`).
- **Refund is wallet-side only.** `PaymentService.refundOrder()` and
  `MerchantOrdersService`'s reject/cancel refund path both call
  `WalletService.refund()` — crediting the customer's platform wallet —
  rather than calling back out to a payment gateway. None of the four
  provider adapters (Paystack/Flutterwave/Moniepoint/Opay) expose a refund
  API yet. **Honest limitation**: a customer who paid by card gets their
  money back as wallet balance, not a reversal to their card. Real gateway
  refund integration is unbuilt.
- **Auto-completion sweep.** `OrderCompletionSweepService` (mirrors
  `ReservationCleanupService`'s interval-timer shape) promotes `DELIVERED`
  orders to `COMPLETED` after `ORDER_AUTO_COMPLETE_AFTER_MS` (24h) unless
  the customer disputes first — disputing moves the order to `DISPUTED`,
  which the sweep's query (`findAutoCompletableOrders`) doesn't match, so
  a dispute silently opts an order out of auto-completion.

## 2. Merchant Operations Platform

### `MerchantOrdersService` (`orders/merchant-orders.service.ts`)

Merchant-facing order lifecycle actions, all scoped via
`findByIdForMerchant` (an order not owned by the acting merchant 404s, not
403s, to avoid confirming order existence to a non-owner):

| Action | Precondition                    | Effect                                                                                         |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Accept | `CONFIRMED`                     | → `PREPARING`, optional `estimatedReadyAt`                                                     |
| Reject | `CONFIRMED`                     | → `CANCELLED`, `cancelledBy: MERCHANT`, wallet-refunds if paid                                 |
| Ready  | `PREPARING`                     | → `READY`, `readyAt` set, emits `ORDER_READY` (triggers delivery dispatch for DELIVERY orders) |
| Delay  | `PREPARING`                     | stays `PREPARING`, updates `estimatedReadyAt`                                                  |
| Cancel | `CONFIRMED`/`PREPARING`/`READY` | → `CANCELLED`, wallet-refunds if paid                                                          |

Every action: audits via `AuditService`, emits a domain event
(`ORDER_ACCEPTED`/`ORDER_REJECTED`/`ORDER_READY`/`ORDER_DELAYED`/
`ORDER_CANCELLED`), and emails the customer via
`NotificationService.notifyOrderLifecycle()` (new method, added alongside
the existing `notifyOrderCreated`/`notifyPaymentResult`).

New `NotificationCenterSubscriber` mappings turn `ORDER_ACCEPTED`,
`ORDER_REJECTED`, `ORDER_READY`, `ORDER_DELAYED`, `ORDER_COMPLETED` into
in-app notifications (new `NotificationType` enum values, migrated
separately from #1's migration since they were identified during #2's
work).

### Store pause/resume (`MerchantsService.pauseStore`/`resumeStore`)

`Business.status` gained a `PAUSED` value (distinct from admin-only
`SUSPENDED`) plus `pausedAt`/`pauseReason` fields — merchant self-service
temporary closure ("out of ingredients", "closed for the day") without
admin involvement. Emits `STORE_PAUSED`/`STORE_RESUMED` domain events (no
in-app notification mapping — pausing is self-initiated, notifying the
merchant of their own action would be redundant; the events exist for
future consumers like search-visibility filtering).

### Out-of-stock toggle (`MerchantProductsService.setOutOfStock`)

`ProductInventory.manuallyDisabled` (added in #1's schema, previously
unused/dead weight) now actually drives availability:
`ProductSearchSyncService.isAvailable()` returns `false` when
`manuallyDisabled` is set, regardless of quantity — closing what would
otherwise have been a shipped-but-non-functional field. Surfaced on
`ProductInventoryDto` (was also missing from the shared type until this
work — merchants had no way to see the toggle's current state via the API).

### Gaps found and closed while building this

Auditing what #1 shipped surfaced four real, previously-undetected issues,
fixed as part of this work rather than left for later:

1. **`CheckoutOrderStatus`** (the admin order-list filter DTO enum) still
   had the _old_ status values after #1's rename — filtering admin orders
   by status was silently broken. Fixed to match the renamed `OrderStatus`.
2. **`merchant:orders:manage` and `admin:orders:manage`** were declared as
   TypeScript permission constants in #1 but never added to the RBAC seed
   data (`permissions.ts`/`role-permissions.ts`) — no real user, including
   admins, actually held them. The entire merchant-ops and admin-refund
   surface would have 403'd for everyone. Added to the seed catalog and
   granted to the `merchant`, `operations_staff`, `administrator`, and
   `super_administrator` roles.
3. **`PaymentService.refundOrder()`** and the **`OrderDispute` repository
   methods** (`createDispute`/`findOpenDisputeForOrder`/`findDisputeById`/
   `resolveDispute`) were fully implemented in #1 but had zero controller
   wiring — unreachable from any HTTP route. Added `AdminPaymentsController`
   (`PATCH /admin/orders/:id/refund`), a customer dispute endpoint
   (`POST /customer/orders/:id/dispute`, requires `DELIVERED` status), and
   an admin resolve endpoint (`PATCH /admin/orders/disputes/:disputeId/resolve`,
   which also completes the order).
4. **`ProductInventoryDto`** never exposed `manuallyDisabled` at all (see
   above).

## Honest limitations

- **No real gateway refunds** — refunds are wallet credits only (see above).
- **No dispute evidence/photos** — `OrderDispute.reason`/`resolution` are
  plain text; no attachment support.
- **Store pause has no scheduled/recurring form** — it's a manual
  toggle only, no "close every Sunday" recurrence (that's multi-branch
  operating-hours territory, DPX-CORE-003 #3, not yet built).
- **Out-of-stock is fully manual** — no automatic disable at zero
  stock or automatic re-enable on restock yet (DPX-CORE-003 #4).
- **No merchant-facing SDK methods** for any of the above yet — the SDK
  gets `sdk.merchants`/`sdk.orders`/`sdk.inventory` extensions in
  DPX-CORE-003 #8; today these are backend-only REST endpoints.
- **No merchant-portal UI** consumes any of this yet — backend-only.

## Deployment notes

Two new migrations, both hand-written (no live Postgres in the dev sandbox,
verified via `prisma validate`/`prisma generate` with a placeholder
`DATABASE_URL`):

- `20260802150000_add_marketplace_commerce_foundation` — the full Order
  State Machine schema change (enum rename + new columns/models).
- `20260802160000_add_merchant_operations_notification_types` — five new
  `NotificationType` enum values, additive only.

Both use `ALTER TYPE ... ADD VALUE` / `RENAME VALUE` as standalone
statements (Postgres requires these outside an explicit transaction block
in some versions; this repo's existing migrations follow the same
one-statement-per-line convention). Run in order on deploy; no data
backfill required since both were verified against zero-production-data
tables.
