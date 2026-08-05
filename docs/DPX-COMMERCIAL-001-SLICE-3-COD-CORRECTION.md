# DPX-COMMERCIAL-001 Slice 3 — Marketplace Cash on Delivery Correction

## 1. Scope (per the founder's locked instruction)

Founder authorization, recorded verbatim:

> Slice 3 scope is limited to: Marketplace Cash on Delivery commercial
> correction; merchant commission accrual for COD; rider cash confirmation
> flow; correct commercial ledger entries; credit-limit interaction;
> exactly-once guarantees; audit trail; real Postgres verification;
> concurrency testing. Nothing else. Do not redesign checkout. Do not
> redesign Rider. Do not redesign Marketplace. Do not introduce new
> payment methods.

Held to "a higher bar" than Slice 2, per the founder, because this slice
changes the settlement direction of code that has already shipped
(tagged in `v1.0-baseline`) — see policy doc §2.1/§3.4.

No new payment method was introduced (CASH already existed). No checkout,
Rider, or Marketplace redesign — the three touched files
(`DeliveryService`/`RiderDeliveryController`, `CashSettlementSubscriber`,
`MerchantSettlementService`) are the same class of "approved commercial
integration point" the founder named for Slice 2, extended here to cover
the one new capability the founder explicitly authorized: "rider cash
confirmation flow."

## 2. The bug being fixed

Before this slice, a Marketplace COD order settled exactly like an
online (mode A) order: `DeliveryService.deliver()` marking a job
`DELIVERED` fired `DELIVERY_COMPLETED`, which `CashSettlementSubscriber`
used to automatically flip `paymentStatus` to `PAID` — with no
confirmation from anyone that cash was actually collected. Once
`PAID`, the eventual `ORDER_COMPLETED` sweep credited the merchant's
Wallet with `gross − commission`, exactly as if DrippleX had collected
and was redistributing real money. It never did — the rider (or
merchant, at the door) physically holds the cash. The correct
relationship is the reverse: the merchant already has the cash in hand,
and owes DrippleX the commission on it. See policy doc §2.1 for the
original diagnosis.

## 3. Schema

One additive migration
(`20260805110000_dpx_commercial_001_delivery_cash_confirmation`): two
nullable columns on `DeliveryJob` — `cashCollectedAmount` and
`cashConfirmedAt`. No other schema change.

## 4. Rider cash-collection confirmation

The founder's named scope item. `DeliveryService.confirmCash()`
(`POST /rider/jobs/:id/confirm-cash`) is new:

- Requires the job be `DELIVERED` (the physical handoff, via `deliver()`,
  already happened — this is the rider's separate digital confirmation
  step afterward) and the order's `paymentMethod` be `CASH`.
- Requires `amountCollected > 0`.
- Idempotent — a second confirmation on an already-confirmed job is a
  no-op, matching `PaymentService.markCashPaymentReceived()`'s existing
  idempotency.
- Persists `cashCollectedAmount`/`cashConfirmedAt` on the `DeliveryJob`,
  records `DELIVERY_AUDIT_ACTIONS.CASH_CONFIRMED` (audit trail item),
  and emits the new `DELIVERY_CASH_CONFIRMED` domain event.

**Deliberate design choice — the confirmed amount is a reconciliation
signal, not a commercial-math input.** `amountCollected` is recorded and
audited (with a `matchesOrderTotal` flag) for ops visibility, but the
merchant's commission accrual is always computed from `order.subtotal` —
the same deterministic source every other settlement path in this
codebase uses (mode A, mode B). Letting a rider-reported figure directly
drive commission math would open a fraud vector (under-reporting to
shrink the merchant's owed commission) and would require inventing a
shortfall/overage reconciliation policy the founder hasn't specified —
exactly the kind of scope expansion Slice 2's own honest-gaps precedent
(§5.6 of that doc) warns against. See §8 below.

## 5. Trigger — from automatic to rider-confirmed

`CashSettlementSubscriber` previously bound to `DELIVERY_COMPLETED` (the
rider's `deliver()` action) — the bug's root cause, since it settled
cash the instant an order was marked delivered, without anyone
confirming collection. It now binds to the new `DELIVERY_CASH_CONFIRMED`
event instead, firing only once the rider explicitly calls
`confirmCash()`. `DELIVERY_COMPLETED` itself is untouched and still
fires from `deliver()` — analytics, loyalty, and notification-center
still subscribe to it for their own unrelated purposes.

## 6. Settlement — accrual, not a Wallet credit

`MerchantSettlementService.settleOrder()`'s mode-B branch (`isMerchantDirect`)
is generalized into `accruesCommission(paymentMethod)`, true for both
`MERCHANT_DIRECT` and `CASH`. Both now settle identically: commission
accrues onto the merchant's `CommissionAccount` via the same exactly-once
`(accountId, referenceType='order', referenceId=orderId)` guard every
other commission mutation uses, instead of crediting Wallet.
`walletLedgerEntryId` stays `null`. `OrderSettlement.merchantAmount`
keeps its existing "notional" meaning (unchanged since Slice 2) — the
merchant already has the cash, so there is nothing left for DrippleX to
credit.

CASH still requires `paymentStatus === PAID` before settling (unlike
mode B, which bypasses that check entirely by design) — the difference
is that `PAID` is now driven by the rider's real confirmation, not an
automatic flip. `ONLINE_PAYMENT_METHODS` (mode A) is unchanged; CASH
never reached that set and still doesn't — it now short-circuits into
the accrual branch before automatic deduction is ever considered.

`reverseSettlement()`'s branch condition is the same generalization
(`accruesCommission`) — a refunded CASH order reverses the commission
accrual (via `reverseAccrual()`, an `ADJUSTMENT`, not capped at the
current balance — see `CommissionAccountService`'s doc comment), not a
Wallet debit that never happened.

## 7. Credit-limit interaction

No new wiring needed. `CheckoutService.assertMerchantApproved()`
(Slice 2) already runs at order-creation time, before the customer picks
a payment method — so a merchant whose `CommissionAccount.blocked` is
already rejected for a would-be CASH order the same as every other
payment method. Verified by a regression test in this slice's test
suite rather than re-implemented.

## 8. Concurrency — a real bug this slice's own testing found

The founder's required concurrency test — two independent CASH orders
for the same merchant settling close together — reproduced a genuine
bug: `CommissionAccountService.accrue()` has no retry of its own. Two
concurrent `accrue()` calls on the same `CommissionAccount` can race on
its optimistic-concurrency `version`; the loser throws
`ConflictDomainException`, which propagated up through `settleOrder()`'s
try/catch and marked the whole settlement `FAILED` instead of retrying —
an unacceptably fragile outcome for an ordinary same-merchant race that
becomes _more_ likely now that CASH and `MERCHANT_DIRECT` both funnel
through the same accrual path. (This same class of bug likely existed
for two concurrent mode-B orders since Slice 2 shipped; Slice 2's own
concurrency test only exercised a single order settled twice, not two
different orders — this slice's broader CASH-driven traffic is what
surfaced it.)

**Fix**: `accrueCommissionWithRetry()` and `reverseAccrualWithRetry()`,
new private methods on `MerchantSettlementService`, wrap `accrue()` and
`reverseAccrual()` in the same bounded 5-attempt retry pattern Slice 2
already established for `applyAutomaticDeduction()`. Unlike a deduction,
an accrual's amount never depends on the current balance, so the retry
is simply "try the same call again" — no recomputation needed, and safe
because `accrue()`/`reverseAccrual()`'s own exactly-once guard
(referenceType/referenceId) makes a retried call idempotent even if an
earlier attempt partially raced.

## 9. Tests

Real-database (same methodology as every prior settlement test in this
file):

- `merchant-settlement.service.spec.ts` — new
  `DPX-COMMERCIAL-001 Slice 3` describe block: CASH accrual (no Wallet
  credit); exactly-once replay; CASH still requires `PAID` before
  settling; reversal (commission reversed, not a Wallet debit);
  **concurrent CASH settlements for the same merchant** (the test that
  found and justified §8's fix); credit-limit interaction regression
  note. The pre-existing Slice 2 "CASH settlements are never touched by
  automatic deduction" test is updated to reflect the corrected
  behavior (CASH now accrues, per this slice) rather than asserting the
  old, buggy Wallet-credit outcome.
- `delivery.service.spec.ts` — new `confirmCash()` describe block:
  confirms and persists on a `DELIVERED` `CASH` order; rejects before
  `DELIVERED`; rejects a non-positive amount; rejects a non-CASH order;
  idempotent on replay.
- `cash-settlement.subscriber.spec.ts` — updated to assert the new
  `DELIVERY_CASH_CONFIRMED` binding.

Test-suite hygiene note: the shared merchant `CommissionAccount` used
across `merchant-settlement.service.spec.ts` is now reset
(`beforeEach`/`afterEach`) at the start of both the Slice 2 and Slice 3
describe blocks — a pre-existing top-level test creates a CASH order,
which (correctly, as of this slice) now also accrues to that same
account, and without the reset it silently polluted the first test in
each describe block's absolute-balance assertions. Fixed as part of
writing this slice's own tests, not a separate change.

## 10. Full verification

- `tsc --noEmit` (backend): clean.
- `eslint src --max-warnings=0` (backend): clean.
- `pnpm --filter @dripplex/types build` / `pnpm --filter @dripplex/sdk
build`: clean (new `ConfirmCashDto` type + `confirmCash()` client
  method).
- `pnpm --filter @dripplex/sdk test`: 152/152 passing.
- `jest --runInBand` (full backend suite): **1296/1299** passing. The
  same 3 pre-existing, unrelated failures as Slice 1/Slice 2's own
  verification rounds (`operations-cases.service.spec.ts`'s `vehicleId`
  FK fixture-drift test, and two `customer-products.service.spec.ts`
  fixture-count assertions) — confirmed via `git status` that this
  session touched neither `operations/` nor `products/`.

## 11. What Slice 3 deliberately does not do

- Does not wire rider/delivery earnings — the founder's authorized scope
  named "merchant commission accrual for COD," not a driver/rider
  commission accrual. No mechanism exists today for crediting a
  Marketplace rider's own earnings for a delivery job at all
  (`WalletOwnerType.RIDER`'s wallet endpoint is read-only; nothing
  credits it) — building a delivery-fee split formula would mean
  inventing product policy the founder hasn't specified, which
  `docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §5 item 2
  already flags as an open, unresolved decision. Left undone rather than
  invented, matching the founder's "Do not redesign Rider" instruction.
- Does not reconcile a mismatch between the rider-confirmed
  `amountCollected` and the order total — recorded for audit/ops
  visibility only (§4), not acted on. A shortfall/overage reconciliation
  policy is its own founder-scoped decision.
- Does not touch Ride cash (`RidePaymentService.confirmCash()`) —
  that's Slice 4, per the policy doc's own §6 plan.
- Does not build any frontend surfacing (Slice 5) — the rider-portal has
  no UI for the new confirm-cash step yet; this slice is backend-only,
  same as Slices 1–2.
- Does not touch the mode-A-deduction-refund gap flagged in Slice 2 §5.6
  — the founder explicitly approved leaving that open pending a separate
  decision.

## 12. ✅ Founder Review — Approved (2026-08-05)

> DPX-COMMERCIAL-001 Slice 3. Status: ✅ Approved. This is the correct
> implementation of the policy we approved. The most important outcome
> is that the original commercial flaw has now been removed: DrippleX
> no longer behaves as though it collected cash that it never actually
> received... [Marketplace COD correction, merchant commission accrual,
> rider cash confirmation, ledger, credit limits, concurrency — each
> individually approved]... A new traffic pattern exposed a genuine
> optimistic-concurrency race. Instead of documenting it, it was fixed
> and verified. That strengthens both Slice 2 and Slice 3... Cash Flow
> Verification — this was worth requiring. Having an end-to-end
> narrative proving every monetary movement is much more valuable than
> only relying on unit tests. That document should remain part of the
> permanent commercial documentation... I specifically approve this
> decision [not inventing rider earnings]. Marketplace rider earnings
> are a separate commercial policy. Nothing in DPX-COMMERCIAL-001 Slice
> 3 required inventing: delivery-fee allocation, rider earnings, fee
> splits, payout timing. Leaving that untouched was the correct
> engineering decision.

`docs/DPX-COMMERCIAL-001-SLICE-3-CASH-FLOW-VERIFICATION.md` is
confirmed as permanent commercial documentation, not a one-off review
artifact — future slices' own Cash Flow Verification docs join it as a
standing record, not something to be superseded or deleted.

## 13. Next step

Slice 4 (Ride Cash Commercial Correction) is founder-authorized — see
`docs/DPX-COMMERCIAL-001-SLICE-4-RIDE-CASH.md`.
