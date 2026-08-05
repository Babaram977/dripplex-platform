# DPX-COMMERCIAL-001 Slice 2 — Marketplace Mode B ("Pay to Merchant")

## 1. Scope (per the founder's locked instruction)

Founder approval, recorded verbatim in scope:

> Implement only the Marketplace Mode B behavior defined in
> DPX-COMMERCIAL-001: wire commission accrual into the approved Marketplace
> settlement flow; support merchant commission accounts; enforce the
> configurable credit-limit policy; apply automatic deduction from Mode A
> (online) settlements where applicable; preserve exactly-once settlement
> guarantees; preserve immutable commercial ledger history; maintain full
> auditability. Do not expand the product scope beyond the approved
> commercial policy. Do not modify frozen modules except through the
> explicitly approved commercial integration points.

The three approved integration points, per
`docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` §3.3/§3.6:
`CheckoutService` (merchant blocking at order-creation time),
`PaymentService` (the new payment-method selection), and
`MerchantSettlementService` (accrual + automatic deduction + reversal).
No other frozen-module file was touched.

## 2. Schema

One additive migration
(`20260805100000_dpx_commercial_001_merchant_direct_payment`): a new
`OrderPaymentMethod` enum value, `MERCHANT_DIRECT`. No other schema
change — deliberately no new `OrderSettlement` column (see §5's design
note on why `merchantAmount`'s existing meaning was sufficient).

## 3. Checkout — merchant blocking

`CheckoutService.assertMerchantApproved()` now also resolves the
merchant's `CommissionAccount` (keyed by `User.id`, resolved from the
`MerchantProfile.userId` already being looked up at that point) and
rejects checkout with a `ValidationDomainException` if `blocked === true`
— the exact integration point the policy doc's §3.6 named. Already-placed
orders are untouched; this is a new-order-only gate, same shape as the
existing approved/suspended-merchant check right next to it.

## 4. Payment method selection — mode B

`PaymentService.selectMerchantDirect()`, mirroring
`selectCashOnDelivery()`'s shape but with two deliberate differences:

- **No fulfilment-type restriction.** CASH is delivery-only (a rider has
  to physically collect it); mode B is "pay the merchant directly"
  (bank transfer/POS), which works identically for pickup or delivery.
- **`paymentStatus` stays `PENDING` for the order's entire lifecycle.**
  DrippleX never digitally verifies this payment — there is no rider
  collection step to later flip it to `PAID` the way CASH does. This is
  not a bug; it honestly reflects that DrippleX never touched the money.

`OrderPaymentMethodDtoEnum` gained `MERCHANT_DIRECT` so a customer can
actually select it via `POST /orders/:id/payments`.

## 5. Settlement — accrual, automatic deduction, reversal

### 5.1 `settleOrder()`'s completion gate

Extended to treat `MERCHANT_DIRECT` orders as settleable on
`status === COMPLETED` alone, bypassing the `paymentStatus === PAID`
requirement — the one deliberate exception, documented inline, since mode
B orders can never reach `PAID` by design (§4).

### 5.2 Mode B — accrual, not a Wallet credit

Instead of crediting `Wallet`, `commissionAmount` accrues onto the
merchant's `CommissionAccount` via `CommissionAccountService.accrue()`,
using the same `(accountId, referenceType='order', referenceId=orderId)`
exactly-once guard every other commission mutation uses.
`OrderSettlement` is still created for the transparency record (gross,
rate, commission) — `walletLedgerEntryId` stays `null` since no Wallet
operation happened.

### 5.3 Mode A/CASH — automatic deduction

For the four online, digitally-verified payment methods
(`WALLET`/`PAYSTACK`/`FLUTTERWAVE`/`OPAY` — `ONLINE_PAYMENT_METHODS`),
`applyAutomaticDeduction()` reads the merchant's current outstanding
balance and, if positive, deducts `min(outstanding, merchantAmount)` via
`CommissionAccountService.recordPayment()` (referenceType
`order_settlement_deduction`) before crediting the remainder to Wallet.
**CASH is deliberately excluded** — its settlement direction is already a
known, separately-tracked defect (§2.1 of the policy doc), fixed in
Slice 3 with its own founder sign-off, not touched here.

`OrderSettlement.merchantAmount` now records **the amount actually
credited** (net of any deduction), not the theoretical pre-deduction
figure — directly satisfying the policy doc's "store... the merchant
amount actually credited" requirement. The paired
`CommissionLedgerEntry` is the durable record of what was deducted and
why.

**Zero-credit edge case, found by the capped-deduction test**: when a
deduction consumes the entire theoretical `merchantAmount`, there is
nothing left to credit — `WalletService.settlement()` correctly rejects a
zero amount. `settleOrder()` now skips the Wallet call entirely in that
case rather than calling it with 0; the `OrderSettlement` still completes
with `merchantAmount: 0` and no `walletLedgerEntryId`.

### 5.4 Concurrency — bounded retry on the shared account

Two orders from the same merchant can complete close enough together
that their settlements' `recordPayment()` calls race on the same
`CommissionAccount`'s optimistic-concurrency `version`. Failing the whole
settlement outright (as the original single-attempt implementation did)
would be a real correctness gap given how ordinary this race is — a
concurrency test written for this slice reproduced it immediately.
`applyAutomaticDeduction()` now retries up to 5 times, re-reading the
current balance and recomputing the deduction each attempt, only
propagating `ConflictDomainException` after the final attempt. Retrying
is safe because `CommissionAccountService.applyMutation()` only creates
the ledger entry after its version-guarded `updateMany()` succeeds — a
failed attempt never leaves a partial ledger entry behind.

### 5.5 Reversal — mode B accrual, not a Wallet debit

`reverseSettlement()` now re-reads the order to check its payment
method. For `MERCHANT_DIRECT`, it calls the new
`CommissionAccountService.reverseAccrual()` instead of
`walletService.debit()` — the sale that produced the accrual no longer
stands (refund), so the commission owed on it shouldn't either.
`reverseAccrual()` is deliberately not routed through `recordPayment()`:
a reversal is not "the merchant paid down their debt," so it is not
capped at the current balance — if the merchant already paid down past
this order's contribution (via a later manual/automatic payment), the
reversal legitimately pushes the balance negative (a credit DrippleX now
owes back), the same way a Wallet refund can leave a customer with an
owed top-up. Recorded as `CommissionEntryType.ADJUSTMENT`, never
`PAYMENT`, so the ledger is honest about why the balance moved. A new
referenceType, `order_commission_reversal`, keeps the reversal a
separate, independently-idempotent ledger entry from the original
accrual.

### 5.6 Honest gap, not fixed here

For a **mode-A order that had an automatic deduction applied**, refunding
it reverses only the Wallet credit — it does not re-credit the deducted
amount back onto the merchant's `CommissionAccount`. Reconciling a
three-way reversal (Wallet, commission balance, and whatever the merchant
may have paid down in the meantime) needs its own explicit founder-scoped
decision; flagged in the code and here rather than silently expanding
Slice 2's scope to invent an answer.

## 6. Tests

`merchant-settlement.service.spec.ts` gained a
`DPX-COMMERCIAL-001 Slice 2` describe block, all real-database
(same methodology as every prior settlement test in this file) —
**11 new tests**, all passing:

- Mode B accrual (no Wallet credit) + exactly-once replay.
- Mode B reversal (commission reversed, Wallet untouched).
- Mode B is never settled before `COMPLETED`.
- Automatic deduction: reduces the credited amount and pays down the
  balance; capped at the theoretical `merchantAmount` (the test that
  caught the zero-credit Wallet-rejection bug, §5.3); CASH is confirmed
  untouched by deduction.
- Concurrency: concurrent mode-B settlements on the same order stay
  exactly-once; concurrent mode-A settlements racing on the same
  outstanding balance never lose an update (the test that justified
  §5.4's retry loop) — verified by asserting the combined credited
  amount across both concurrent settlements exactly equals
  `grossAmount − alreadyOutstanding`, and the account reaches zero, not a
  double-deducted negative or an under-deducted positive.

`checkout.service.spec.ts` gained one test: a merchant whose
`CommissionAccount.blocked === true` is rejected at checkout with a
`ValidationDomainException`.

## 7. Full verification

- `tsc --noEmit`: clean.
- `eslint src --max-warnings=0` (whole backend): clean.
- `pnpm --filter @dripplex/types build` / `pnpm --filter @dripplex/sdk
build`: clean (only the `OrderPaymentMethod` union gained
  `'MERCHANT_DIRECT'` — no new SDK client surface, since Slice 2
  introduced no new API endpoint).
- `jest --runInBand` (full suite): **1285/1288** passing. The same 3
  pre-existing, unrelated failures as Slice 1's verification round
  (`operations-cases.service.spec.ts`'s `vehicleId` FK fixture-drift
  test, and two `customer-products.service.spec.ts` fixture-count
  assertions) — confirmed via `git status` that this session touched
  neither `operations/` nor `products/`.

## 8. Slice production audit

- **Module completeness against §1's scope**: all seven founder-named
  items present — commission accrual wired into the real settlement flow
  (§5.2), merchant commission accounts (Slice 1, exercised here for the
  first time), configurable credit-limit policy enforced at checkout
  (§3), automatic deduction from mode-A settlements (§5.3), exactly-once
  preserved (unique `(accountId, referenceType, referenceId)` guard on
  every accrual/deduction/reversal — §5.2-§5.5), immutable ledger history
  (every balance change is a `CommissionLedgerEntry`, none ever
  updated/deleted, only appended), full auditability (`AuditService.
record()` on every blocked/unblocked transition and admin/automatic
  payment — unchanged from Slice 1, now actually exercised by real
  accrual traffic for the first time).
- **SDK coverage**: no new endpoint was added in this slice (checkout
  blocking and payment-method selection both reuse existing routes), so
  no SDK gap exists to close.
- **Error handling**: `ValidationDomainException` for a blocked
  merchant at checkout and for a payment amount ≤ 0; `ConflictDomainException`
  surfaces (after bounded retry) for a genuine unretryable concurrency
  failure rather than silently corrupting a balance; `WalletService`'s
  own zero-amount rejection is respected, not bypassed, by skipping the
  credit step instead of forcing a call that would throw (§5.3).
- **Performance**: `applyAutomaticDeduction()`'s retry loop is bounded
  (5 attempts) and only activates on an actual concurrent write
  conflict, not on every settlement — the common case (no outstanding
  balance) exits after one read with no write at all. No new N+1 pattern
  — the same single `getOrCreateAccount()` read per settlement attempt
  as Slice 1.
- **Production readiness**: no new deployment consideration — this
  slice ships inside the same backend build as Slice 1, no new env var,
  no new external dependency.

## 9. What Slice 2 deliberately does not do

- Does not fix Marketplace Cash on Delivery's settlement direction
  (Slice 3, separate founder sign-off — a behavior change to
  already-shipped code).
- Does not wire Ride cash (Slice 4).
- Does not build any frontend surfacing (Slice 5) — merchants cannot yet
  see their `CommissionAccount` balance or blocked status anywhere in
  merchant-portal; `admin/commercial/accounts/...` (Slice 1) is the only
  way to inspect it today.
- Does not reconcile the mode-A-deduction-refund gap (§5.6).
- Does not add a per-account credit-limit override — only the per-owner-
  type global setting from Slice 1.

## 10. Next step

Return for Founder Review of Slice 2 before proceeding to Slice 3
(fixing Marketplace Cash on Delivery's settlement direction — a
behavior change to shipped code, flagged for separate sign-off per the
policy doc's own §6 plan).
