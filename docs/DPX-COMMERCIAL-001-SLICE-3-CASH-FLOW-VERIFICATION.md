# DPX-COMMERCIAL-001 Slice 3 — Cash Flow Verification

Founder-required artifact, requested verbatim before Slice 3 could be
brought back for review:

> Before asking for Slice 3 review, Claude should produce one additional
> verification document: Cash Flow Verification. Walking through a
> complete COD order from Customer Order → Merchant Accepts → Rider
> Picks Up → Customer Pays Cash → Rider Confirms Collection → Merchant
> Commission Accrual → CommissionAccount Update → Blocking/Unblocking
> Logic → Commercial Ledger → Audit Trail → Exactly-once Verification. I
> want one end-to-end narrative proving every monetary movement is
> correct.

This walks one concrete, worked example end-to-end through the real
code paths exercised by this slice's own tests
(`merchant-settlement.service.spec.ts`, `delivery.service.spec.ts`),
citing the exact methods and files at each step. Every number below is
the actual arithmetic the code performs, not illustrative rounding.

**Worked example**: a merchant with a 10% commission rate (the platform
default — `MerchantCommissionSettingsService`), no prior outstanding
commission balance, sells a ₦10,000 order (subtotal) to a customer who
chooses Cash on Delivery.

---

## 1. Customer Order

`CheckoutService.checkout()` creates the `Order` (status `PENDING`
→ `CONFIRMED` once payment method is selected). Before the order is even
created, `assertMerchantApproved(cart.merchantId)` runs
(`apps/backend/src/orders/checkout.service.ts:88`) — this is where
**Blocking Logic** is enforced, first checkpoint (see §8; nothing to
report yet since this merchant has no outstanding balance).

The customer then calls `PaymentService.initializePayment()` with
`method: CASH`. `selectCashOnDelivery()`
(`apps/backend/src/payments/payment.service.ts:278`) confirms the order
immediately — `paymentMethod: CASH`, `paymentStatus: PENDING` — and
records `PAYMENT_AUDIT_ACTIONS.INITIALIZED` (first **Audit Trail**
entry). No money has moved yet. The merchant sees a ₦10,000 sale.

## 2. Merchant Accepts

Out of Slice 3's scope (merchant order-acceptance flow is unchanged,
DPX-MERCHANT-001/DPX-CORE-003 territory) — the order proceeds through
its normal `CONFIRMED → PREPARING → READY` states. Still no money has
moved; `paymentStatus` remains `PENDING`.

## 3. Rider Picks Up

`DeliveryService` creates a `DeliveryJob` for the order and assigns a
rider (`assignRider()`/auto-assignment, unchanged, out of Slice 3's
scope). The rider progresses the job `ASSIGNED → ACCEPTED → PICKED_UP →
ON_THE_WAY → ARRIVED`, none of which touch payment state. Still no
money has moved.

## 4. Customer Pays Cash

At the door, the rider hands over the goods and physically receives
₦10,000 cash from the customer — a real-world event the backend cannot
observe directly. `DeliveryService.deliver()`
(`apps/backend/src/delivery/delivery.service.ts:299`) records the
handoff: creates a `DeliveryProof`, transitions the job to `DELIVERED`,
transitions the `Order` to `DELIVERED`, and emits `DELIVERY_COMPLETED`
(consumed by analytics/loyalty/notifications — unrelated to money).
**`paymentStatus` is still `PENDING`** at this point — this is the exact
gap Slice 3 closes (see §5 of the correction doc): before this slice,
`DELIVERY_COMPLETED` alone would have already triggered settlement here,
with no confirmation cash was actually collected.

## 5. Rider Confirms Collection

The rider calls the new endpoint,
`POST /rider/jobs/:id/confirm-cash` → `DeliveryService.confirmCash()`
(`apps/backend/src/delivery/delivery.service.ts`), with
`amountCollected: 10000`:

1. Requires the job be `DELIVERED` (✓ — just transitioned in §4) and the
   order's `paymentMethod` be `CASH` (✓).
2. Requires `amountCollected > 0` (✓ — 10000).
3. Persists `cashCollectedAmount: 10000`, `cashConfirmedAt: <now>` on the
   `DeliveryJob` via `DeliveryRepository.confirmCash()`.
4. Records `DELIVERY_AUDIT_ACTIONS.CASH_CONFIRMED`
   (**Audit Trail**) with metadata `{ amountCollected: 10000, orderTotal:
10000, matchesOrderTotal: true }` — the reconciliation signal
   mentioned in §4 of the correction doc; not used for commercial math.
5. Emits `DELIVERY_CASH_CONFIRMED`.

`CashSettlementSubscriber` (now bound to `DELIVERY_CASH_CONFIRMED`, not
`DELIVERY_COMPLETED` — the fix) receives the event and calls
`PaymentService.markCashPaymentReceived(orderId)`, which flips
`paymentStatus: PENDING → PAID` and emits `ORDER_PAID`. **This is the
first monetary state change**: the system now formally knows the sale
was paid for, entirely gated on the rider's real confirmation.

Some time later (governed by `OrderCompletionSweepService`'s 24h
auto-complete window, unchanged), the order transitions
`DELIVERED → COMPLETED` and fires `ORDER_COMPLETED` — the signal
`MerchantSettlementService` is listening for.

## 6. Merchant Commission Accrual

`MerchantSettlementService.settleOrder(orderId)`
(`apps/backend/src/orders/merchant-settlement.service.ts:113`):

1. Re-reads the order defensively. Gate check: `status === COMPLETED`
   (✓) and, since this is CASH not `MERCHANT_DIRECT`,
   `paymentStatus === PAID` (✓ — set in §5).
2. Reads the effective commission rate: 10%.
3. Computes: `grossAmount = 10000`, `commissionAmount = 1000`,
   `merchantAmount = 9000` (theoretical/notional — see §7 of the
   correction doc on why this figure is never credited anywhere).
4. Creates the `OrderSettlement` row (`status: PENDING`) — this insert's
   unique constraint on `orderId` is the first **exactly-once** guard
   (§11 below).
5. `accruesCommission(order.paymentMethod)` → `true` for `CASH`. Calls
   `accrueCommissionWithRetry({ ownerType: MERCHANT, ownerId:
<merchant's User.id>, amount: 1000, referenceType: 'order',
referenceId: orderId, description: 'Commission owed for order
... (Cash on Delivery)' })`.
6. **No Wallet credit happens.** `walletLedgerEntryId` stays `null`.
   This is the corrected direction: the merchant already holds the
   ₦10,000 cash; DrippleX did not touch it and has nothing to pay out.
   What DrippleX is owed is the ₦1,000 commission, which is what step 7
   records.
7. `OrderSettlement.status → COMPLETED`.
8. Records `ORDER_AUDIT_ACTIONS.SETTLEMENT_COMPLETED`
   (**Audit Trail**) with metadata including `grossAmount: 10000`,
   `commissionAmount: 1000`, `paymentMethod: 'CASH'`,
   `creditedVia: 'commission_account'`.

## 7. CommissionAccount Update

Inside `accrueCommissionWithRetry()` →
`CommissionAccountService.accrue()` →
`applyMutation()`
(`apps/backend/src/commercial/commission-account.service.ts:230`):

1. Reads (or lazily creates, seeded with the effective credit limit —
   default ₦10,000) the merchant's `CommissionAccount`
   (`ownerType: MERCHANT, ownerId: <User.id>`).
2. Exactly-once pre-check: no existing `CommissionLedgerEntry` for
   `(accountId, referenceType: 'order', referenceId: orderId)` — none
   found, proceeds.
3. `nextBalance = currentBalance (0) + 1000 = 1000`.
4. Version-guarded `updateMany({ where: { id, version: 0 }, data: {
outstandingBalance: 1000, version: 1 } })` — succeeds (1 row
   affected). If a concurrent settlement for the same merchant had won
   this race instead, `accrueCommissionWithRetry()`'s bounded 5-attempt
   loop re-reads the current balance and retries rather than failing the
   settlement outright (see §11).
5. Creates the `CommissionLedgerEntry` (see §9).

**Result: the merchant's `CommissionAccount.outstandingBalance` is now
₦1,000** — DrippleX is owed ₦1,000 in commission on this sale. This is
the corrected end state the whole slice exists to produce.

## 8. Blocking/Unblocking Logic

After the mutation, `recomputeAndPersistBlockState()`
(`apps/backend/src/commercial/commission-account.service.ts:319`) reads
the currently-effective credit limit (₦10,000, unchanged for this
merchant) and recomputes `blocked = outstandingBalance > creditLimit`.
`1000 > 10000` is `false` — the account stays unblocked. Nothing to
audit (blocking transitions are only recorded when `blocked` actually
changes).

**If this merchant had ₦9,500 already outstanding** (from a prior
mode-B or mode-C sale) before this ₦1,000 accrual, the new total
(₦10,500) would exceed the ₦10,000 limit, `blocked` would flip to
`true`, a `COMMERCIAL_AUDIT_ACTIONS.BLOCKED` audit entry would be
recorded, and the very next `checkout()` attempt for this merchant would
be rejected by `CheckoutService.assertMerchantApproved()`
(`apps/backend/src/orders/checkout.service.ts:515`) — this is the same
blocking gate exercised for every payment method uniformly (§7 of the
correction doc; no CASH-specific wiring was needed). The merchant would
be automatically unblocked the moment a payment (automatic deduction
from a mode-A sale, or an admin-manual recording) brought the balance
back to ₦10,000 or below.

## 9. Commercial Ledger

The `CommissionLedgerEntry` created in §7 step 5 is the durable,
immutable record:

| field           | value                                                        |
| --------------- | ------------------------------------------------------------ |
| `accountId`     | the merchant's `CommissionAccount.id`                        |
| `type`          | `ACCRUAL`                                                    |
| `amount`        | 1000                                                         |
| `balanceAfter`  | 1000                                                         |
| `referenceType` | `'order'`                                                    |
| `referenceId`   | the order's id                                               |
| `description`   | `Commission owed for order <orderNumber> (Cash on Delivery)` |

No `CommissionLedgerEntry` row is ever updated or deleted — every
future balance change (an automatic deduction from a later mode-A sale,
an admin-manual payment, a refund reversal) appends a new row with its
own `balanceAfter` snapshot. The full history of _why_ the balance is
what it is at any point in time is reconstructable from this table
alone, exactly like `WalletLedgerEntry` for asset balances.

## 10. Audit Trail

Every step above that changed state also wrote to the (separate) audit
log via `AuditService.record()`:

1. `PAYMENT_AUDIT_ACTIONS.INITIALIZED` — customer selected CASH (§1).
2. `DELIVERY_AUDIT_ACTIONS.COMPLETED` — rider marked the job delivered
   (§4).
3. `DELIVERY_AUDIT_ACTIONS.CASH_CONFIRMED` — rider confirmed collecting
   ₦10,000, flagged as matching the order total (§5).
4. `PAYMENT_AUDIT_ACTIONS.VERIFIED` — `markCashPaymentReceived()`
   flipped `paymentStatus` to `PAID` (§5).
5. `ORDER_AUDIT_ACTIONS.SETTLEMENT_COMPLETED` — the settlement
   completed via commission accrual, full financial metadata attached
   (§6).

Two independent trails (audit log + commercial ledger) both agree on
what happened and why, at every step — the same "no financially-sensitive
mutation without an audit record" standard every other module in this
codebase (`MerchantSettlementService`, `WalletService`,
`DriverSecuritySettingsService`) already holds itself to.

## 11. Exactly-once Verification

Three independent guarantees, each exercised by this slice's own tests:

1. **`OrderSettlement.orderId` unique constraint** — a replayed
   `settleOrder(orderId)` call (e.g., a duplicate `ORDER_COMPLETED`
   event) either wins the `create()` race or catches the unique-
   constraint violation and re-reads the winner's row; either way, the
   commission accrues exactly once per order. Tested: "replayed CASH
   settlement on the same order stays exactly-once."
2. **`CommissionLedgerEntry` unique `(accountId, referenceType,
referenceId)`** — even if `accrue()` were somehow called twice for
   the same order (defense in depth beyond guarantee 1), the second call
   finds the existing ledger entry and no-ops (`applied: false`),
   never double-crediting the balance.
3. **Concurrency — two _different_ orders for the same merchant
   settling at the same time.** This is the guarantee that was actually
   broken before this slice's fix (§8 of the correction doc): two
   concurrent `accrue()` calls on the same `CommissionAccount` racing on
   its optimistic-concurrency `version` — the loser used to throw
   `ConflictDomainException` and fail the whole settlement. Verified
   fixed by the test "concurrent CASH settlements for the same merchant
   never lose an accrual to the shared CommissionAccount race": two
   orders (₦300 and ₦400 commission) settled via `Promise.all()`, both
   completed successfully, and the account's final balance is exactly
   the sum of both (₦700) — no lost update, no failed settlement.

**Bottom line for the worked example**: ₦10,000 changed hands physically
(customer → rider → merchant, never touching DrippleX), and exactly
₦1,000 of commercial debt was correctly recorded as owed to DrippleX,
via one accrual, appearing once in the commercial ledger, fully audited,
and safe under concurrent settlement traffic.
