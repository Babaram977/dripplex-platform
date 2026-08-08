# 🔒 DPX-D4 — Ride Refund Policy (Founder Approved & Frozen)

Founder-locked decision record for ride refunds. Implemented in PR #70
(`DPX-D4`, merged to `main` as `b9d403e`). This document records **what was
decided and what the code does** — it is the source of truth for the refund
rules; the code is the ground truth for behaviour.

Related: `docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md` (the
commission/settlement engine this reuses), `docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md`
and `docs/DPX-COMMERCIAL-001-SLICE-4-RIDE-CASH.md` (the settlement paths a
refund reverses), and the D7 ride-settlement atomicity work (the
guarded-transition / idempotency pattern refunds follow).

## Scope

First-generation ride refunds, built entirely on the existing idempotent
Wallet + CommissionAccount primitives. **No payment-gateway (PSP) refund
adapters** are introduced — a deliberately deferred, larger effort.

Before D4, rides had no refund path at all: `RidePaymentStatus.REFUNDED` and
the `RIDE_REFUNDED` event existed in the schema but were never written/emitted.

## Locked decisions

1. **Ride refunds: YES.** Admin/Operations initiate; no customer self-service
   refund. Only a **settled (PAID)** ride can be refunded.
2. **Full refund only.** No partial refunds in D4; partial-refund capability
   stays deferred.
3. **Gateway-paid rides refund to the DrippleX (Dx) Wallet, not the PSP.** No
   gateway refund adapters are built; the customer receives the approved refund
   as a Dx-Wallet credit — matching the existing order-refund architecture.
4. **Driver earnings: claw back.** Reverse the driver's ride earning. If the
   driver's wallet cannot cover it, record a **recoverable driver liability**
   rather than silently failing or letting money disappear.
5. **Platform commission: claw back.** Reverse the ride's 15% commission using
   the existing idempotent mechanism. `RIDE_PLATFORM_COMMISSION_RATE` is
   **unchanged**.
6. **Cash rides.** The customer's physical cash is outside the digital wallet —
   reverse only the driver's commission accrual/liability; do **not** manufacture
   a digital customer refund.
7. **Refund state/event.** Write the existing `REFUNDED` statuses; emit the
   existing `RIDE_REFUNDED` event; preserve its notification consumer.
8. **Idempotency.** Exactly-once. Duplicate requests/callbacks must not create
   duplicate wallet credits, clawbacks, or commission reversals. Follows the D7
   transaction/guard/retry pattern.
9. **Reconciliation.** D4 stays report-only; no automatic repair/reconciliation
   engine is built.

## Final rulings on the four flagged behaviours

After reviewing what the PR implements (not proposed behaviour), the founder
locked these four points:

1. **Driver debt ↔ credit-block — ACCEPT.** An un-recovered clawback is recorded
   as an `ADJUSTMENT/INCREASE` on the driver's `CommissionAccount`
   (`CommissionAccountService.recordLiability`) and runs the normal block-state
   recompute. It therefore raises the driver's outstanding balance and, if the
   balance crosses the credit limit (`DEFAULT_DRIVER_CREDIT_LIMIT = 10,000`),
   the **existing** credit-limit block prevents the driver going online until it
   clears. No special new rule; existing credit-block behaviour is the
   enforcement mechanism.
2. **Platform fronts the refund — ACCEPT.** The customer's Dx-Wallet refund is
   funded by a platform-wallet debit. When the clawback lands as a debt, the
   platform fronts the shortfall from its operating balance (the driver
   liability is the offsetting receivable). If the platform wallet lacks funds,
   the refund **fails atomically** and the ride remains `PAID` — the platform
   wallet is **never** driven negative.
3. **Tips — EXCLUDE.** Ride refunds touch only the fare legs (`ride_refund`,
   `ride_earning_reversal`) and, for cash, the commission reversal. `ride_tip`
   entries are never read or reversed — a tip stays with the driver.
4. **CommissionAccount check-then-create race — DEFER.** D4 does not expand to
   fix the first-touch `findUnique`-then-`create` race in the commission
   primitives. It is recorded as the **next commission-service hardening item**
   and must not be pulled into D4.

## How the code implements it (summary)

- **Entry point:** `POST admin/rides/:id/refund`
  (`AdminRidePaymentsController`), guarded by the existing
  `admin:rides:support` permission (held by operations_staff / administrator /
  super_administrator) — no new permission. Body: `RefundRideDto { reason }`.
- **Exactly-once gate:** all money legs run first (each idempotent by
  `(wallet/account, referenceType, ride.id)`), then a guarded
  `updateMany WHERE paymentStatus = PAID → REFUNDED`. A duplicate/concurrent
  refund sees `count === 0` and is rejected; its legs were idempotent no-ops.
  Wallet/commission version conflicts are bounded-retried (`withConflictRetry`).
- **WALLET / gateway (PAYSTACK/FLUTTERWAVE):** mirror settlement's four legs —
  claw the driver earning back to the platform, then release the captured fare
  from the platform and credit the customer's Dx Wallet. Platform nets
  −commission. Gateway `RidePaymentTransaction` → `REFUNDED`.
- **Driver clawback shortfall:** `recordLiability` (mirror of `reverseAccrual`,
  an `ADJUSTMENT/INCREASE`), reference type `ride_earning_clawback_debt`.
- **CASH:** `reverseAccrual` on the driver's commission only
  (`ride_commission_reversal`); no customer wallet movement; `RIDE_REFUNDED`
  emitted without an `amount` so no bogus "₦0 refunded" notification.
- **Verification:** 10 deterministic real-Postgres tests (30/30 stress incl.
  concurrency + the debt path); full backend suite 1,429/1,429; typecheck /
  lint / security / CI green.

## Deferred follow-ups (not in D4)

- Partial ride refunds (decision 2).
- Gateway (PSP) refund adapters — refund-to-PSP instead of Dx-Wallet (decision 3).
- Automatic refund reconciliation / repair (decision 9).
- `CommissionAccount` first-touch check-then-create race — next commission-service
  hardening item (ruling 4).
