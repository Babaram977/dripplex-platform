# DPX-MERCHANT-002 — Marketplace Merchant Settlement: Design

Founder-approved (2026-08-05) as a narrowly-scoped addition to Phase 2,
found while auditing the merchant activation gate for DPX-MERCHANT-001
(`DPX-MERCHANT-001-REALITY-AUDIT.md` §9-12, which records the full
decision history this design implements). No withdrawals/payouts,
accounting software, or complex settlement platform — the minimum
production requirement only: **Customer payment → Order → successful
fulfilment → merchant settlement calculation → merchant wallet credit →
immutable ledger entry**, exactly-once, auditable, retryable-on-failure.

## 1. Trigger — what "successful fulfilment" means, read from real code

`OrderCompletionSweepService` (`apps/backend/src/orders/
order-completion-sweep.service.ts`) is the sole path that transitions an
`Order` to `OrderStatus.COMPLETED` and emits `DOMAIN_EVENTS.ORDER_COMPLETED`
— it auto-completes `DELIVERED` orders 24h after delivery unless disputed
or cancelled. This is the authoritative "successful fulfilment" signal for
both payment paths, because payment always precedes it:

- **Gateway/Wallet payments** (`PaymentService.verifyPayment`) reach
  `paymentStatus = PAID` at checkout time, long before the order can reach
  `COMPLETED`.
- **Cash on Delivery** reaches `paymentStatus = PAID` via
  `PaymentService.markCashPaymentReceived()`, itself triggered by
  `DELIVERY_COMPLETED` — which necessarily precedes the order reaching
  `DELIVERED` and then, 24h later, `COMPLETED`. `markCashPaymentReceived`
  is already idempotent (a no-op if already `PAID` or not a `CASH` order)
  and already emits its own `ORDER_PAID` event — settlement does not need
  to listen for `ORDER_PAID` directly; by the time `ORDER_COMPLETED`
  fires, `paymentStatus` is guaranteed `PAID` for any order that reached
  `COMPLETED` through the normal lifecycle.

**Design**: `MerchantSettlementService` subscribes to
`DOMAIN_EVENTS.ORDER_COMPLETED`. On receipt, it re-reads the `Order` fresh
from the database (never trusts the event payload for financial
decisions) and requires `status === COMPLETED && paymentStatus === PAID`
before proceeding — a defensive guard, not an expected failure path, since
the sweep itself only fires `ORDER_COMPLETED` after that's already true.

## 2. Commission base and rate

Per the founder's decision (`DPX-MERCHANT-001-REALITY-AUDIT.md` §11-12):

- **Base**: `order.subtotal` — the full merchandise value, _not_ reduced
  by `order.discount`. Correct today because merchant self-service
  promotions don't exist (Phase 3, on hold — only admins can create
  `Promotion` rows), so every discount that exists is definitionally
  platform-funded; the founder's own rule ("platform-funded promotions
  must not reduce merchant earnings") makes `subtotal` the right base
  without needing a schema change to trace discount funding source. A
  real, separate defect found in the same trace —
  `PromotionsService.handleCouponRedeemed()` is a dead no-op, so
  `PromotionRedemption` rows are never created from checkout at all — is
  flagged in the reality audit but **not fixed here**; it doesn't touch
  Merchant and doesn't block this design given the above.
- **Delivery fee and tax are excluded** from the base by construction —
  `order.subtotal` never includes them (see `PricingService.computeTotals`,
  `apps/backend/src/pricing/pricing.service.ts` — `subtotal`,
  `deliveryFee`, and `tax` are three separate fields).
- **Rate**: admin-configurable, default 10%, launch value 10%. Modeled as
  a singleton `MerchantCommissionSetting` row (get-or-create, validated
  update, full audit log — the exact pattern already established for
  `DriverSecuritySettings`,
  `apps/backend/src/drivers/identity-verification/
driver-security-settings.service.ts`, `docs/
DPX-DRIVER-001-SECURITY-STANDARD.md`). Read once at settlement-calculation
  time and **snapshotted permanently** into the `OrderSettlement` row it
  produces — a later rate change never touches past settlements, since
  nothing ever re-reads or recalculates an already-created row.

Merchant settlement amount = `roundMoney(subtotal - roundMoney(subtotal *
rate))`.

## 3. Merchant identity resolution — a real ID-space mismatch to get right

`Order.merchantId` stores `MerchantProfile.id` (confirmed via
`CheckoutService.assertMerchantApproved()`'s
`prisma.merchantProfile.findFirst({ where: { id: merchantId } })`, and via
`MerchantOrdersService`'s own doc comment: "`merchantId` on Order/OrderItem
is `MerchantProfile.id`"). But `Wallet` rows for merchants are keyed by
`User.id` — confirmed via `MerchantWalletController`'s
`walletService.getWallet(WalletOwnerType.MERCHANT, user.id)`, where `user`
is the authenticated `User`, not a `MerchantProfile`. These are two
different ID spaces. `MerchantSettlementService` must resolve
`MerchantProfile.findUnique({ where: { id: order.merchantId } }).userId`
before calling `WalletService`, exactly the same reverse-resolution
`MerchantOrdersService.resolveMerchantProfileId()` already does in the
opposite direction (`User.id` → `MerchantProfile.id`).

## 4. Schema

```prisma
model MerchantCommissionSetting {
  id           String   @id @default(uuid()) @db.Uuid
  commissionRate Decimal @default(0.10) @db.Decimal(5, 4) // e.g. 0.1000 = 10%
  updatedBy    String?  @map("updated_by") @db.Uuid
  updatedAt    DateTime @updatedAt @map("updated_at")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("merchant_commission_settings")
}

enum OrderSettlementStatus {
  PENDING
  COMPLETED
  FAILED
  REVERSED
}

model OrderSettlement {
  id                 String                 @id @default(uuid()) @db.Uuid
  orderId            String                 @unique @map("order_id") @db.Uuid
  merchantId         String                 @map("merchant_id") @db.Uuid // MerchantProfile.id, matching Order.merchantId
  status             OrderSettlementStatus  @default(PENDING)
  grossAmount        Decimal                @map("gross_amount") @db.Decimal(12, 2) // order.subtotal at calculation time
  commissionRate     Decimal                @map("commission_rate") @db.Decimal(5, 4) // snapshotted, never re-read
  commissionAmount   Decimal                @map("commission_amount") @db.Decimal(12, 2)
  merchantAmount     Decimal                @map("merchant_amount") @db.Decimal(12, 2) // grossAmount - commissionAmount
  currency           String                 @default("NGN") @db.VarChar(3)
  walletLedgerEntryId String?               @map("wallet_ledger_entry_id") @db.Uuid
  failureReason      String?                @map("failure_reason") @db.VarChar(1000)
  reversedAt         DateTime?              @map("reversed_at")
  reversalReason     String?                @map("reversal_reason") @db.VarChar(1000)
  reversalLedgerEntryId String?             @map("reversal_ledger_entry_id") @db.Uuid
  createdAt          DateTime               @default(now()) @map("created_at")
  updatedAt          DateTime               @updatedAt @map("updated_at")
  order              Order                  @relation(fields: [orderId], references: [id], onDelete: Restrict)

  @@index([merchantId])
  @@index([status])
  @@map("order_settlements")
}
```

`orderId @unique` is the exactly-once guard. `onDelete: Restrict` on the
`Order` relation — a settled order's financial record must never be
silently cascade-deleted.

## 5. Exactly-once mechanism

A two-phase status model, not a single atomic wallet call, so a failure
between steps is detectable and retryable rather than silently losing
merchant money:

1. **Attempt to create** the `OrderSettlement` row with `status: PENDING`,
   `grossAmount`/`commissionRate`/`commissionAmount`/`merchantAmount`
   already computed. The `orderId` unique constraint is the real
   concurrency guard: if a replayed/concurrent `ORDER_COMPLETED` handler
   races this insert, the loser hits a Prisma `P2002` unique-constraint
   violation, which is caught and treated as "already being settled" —
   log and return, no error surfaced, no duplicate row, no duplicate
   credit attempt.
2. **Call `WalletService.settlement()`** (`apps/backend/src/wallet/
wallet.service.ts` — the existing `WalletTransactionType.SETTLEMENT`
   mutation, the same Wallet/Ledger architecture every other credit on the
   platform uses, not a new balance system) with `ownerType: MERCHANT`,
   the resolved `User.id`, `amount: merchantAmount`, `referenceType:
'order_settlement'`, `referenceId: orderId` — this is what ties the
   ledger entry to a specific order and produces the required immutable
   ledger entry (`WalletLedgerEntry` rows are append-only by construction
   everywhere else on the platform; nothing about this design changes
   that).
3. **On success**, update the `OrderSettlement` row to `status: COMPLETED`
   with `walletLedgerEntryId` set. On failure (wallet mutation throws for
   any reason), update to `status: FAILED` with `failureReason` set — the
   row stays queryable and retryable (a future retry sweep or manual
   admin action can find `status: FAILED` rows and re-attempt step 2
   against the same row, never re-creating step 1's row, so the
   `orderId`-unique guarantee holds across retries too).

This mirrors the idempotent lazy-creation pattern already proven for
`OperationsCase` under concurrent requests (DPX-OPS-001's
"Concurrency test: idempotent lazy case creation" task) — same shape,
applied to money instead of a case record.

## 6. Reversal — refund/cancellation audit

`PaymentService.refundOrder()` (`apps/backend/src/payments/
payment.service.ts:856`) requires only `paymentStatus === PAID`, not any
particular `status` — so it **can** be called on an already-`COMPLETED`
(and therefore already-settled) order. It already refunds the customer's
wallet and emits `DOMAIN_EVENTS.ORDER_REFUNDED` with `orderId`/
`merchantId`/`amount`/`reason`, but today does nothing merchant-side —
confirming this really is new ground, not a place already handled
elsewhere.

**Design**: `MerchantSettlementService` also subscribes to
`ORDER_REFUNDED`. On receipt, it looks up `OrderSettlement` by `orderId`;
if none exists or it isn't `COMPLETED`, no-op (the order was never
settled, so there's nothing to reverse). If a `COMPLETED` settlement
exists, it debits the merchant's wallet for `merchantAmount` (via
`WalletService.debit()`, `referenceType: 'order_settlement_reversal'`,
`referenceId: orderId` — its own ledger entry, never mutating or deleting
the original credit's ledger row) and updates the `OrderSettlement` row to
`status: REVERSED` with `reversedAt`/`reversalReason`/
`reversalLedgerEntryId` set. The original `COMPLETED` row's gross/
commission/merchant amounts are left untouched — `REVERSED` is a status
transition layered on top of the historical record, not a rewrite of it,
preserving exactly what was actually settled and when.

**Cancellation** (`OrderStatus.CANCELLED`) is not a concern for reversal:
`OrderCompletionSweepService.findAutoCompletableOrders` only completes
`DELIVERED` orders, and cancellation happens well before delivery in the
Universal Order State Machine — a `COMPLETED` order cannot subsequently
become `CANCELLED` (no such transition exists), so there is no
cancellation-after-settlement case to design for. Refund is the only
after-the-fact reversal path, and it's handled above.

## 7. Permission and admin surface

New permission `admin:merchant-settlement:commission:manage`, gating a new
admin controller (`GET`/`PATCH` on the commission setting), following the
same `RequirePermissions` + `AuditService.record()` pattern as
`DriverSecuritySettingsService`'s admin endpoints — every rate change
records previous rate, new rate, `changedBy`, and timestamp via the
standard audit trail, satisfying the founder's explicit requirement
without inventing a parallel audit mechanism.

## 8. Test plan (task #400)

Real database E2E tests, matching the module's own existing pattern
(Postgres, not mocked Prisma), covering at minimum:

1. Paid order → `ORDER_COMPLETED` → exactly one `OrderSettlement` row,
   `status: COMPLETED`, correct gross/commission/merchant amounts, and
   exactly one `WalletLedgerEntry` crediting the merchant's wallet.
2. The same `ORDER_COMPLETED` event replayed/emitted twice (or two
   concurrent handlers racing the same order) → still exactly one
   `OrderSettlement` row and exactly one wallet credit — the `P2002`
   race path is actually exercised, not just reasoned about.
3. COD order: `markCashPaymentReceived` → (simulate the sweep) →
   `ORDER_COMPLETED` → settles exactly like a gateway/wallet order, same
   commission math, confirming the single-trigger design correctly
   handles both payment methods without special-casing.
4. Commission-rate changes mid-flight: settle one order at 10%, change the
   rate to a different value, settle a second order — first settlement's
   stored `commissionRate` must remain 10% (never retroactively
   recalculated); second settlement uses the new rate.
5. Refund after completion: settle an order, then `refundOrder()` it →
   `OrderSettlement.status` becomes `REVERSED`, a reversal `WalletLedgerEntry`
   debits the merchant, and the merchant's wallet balance nets back to
   what it was before settlement.
