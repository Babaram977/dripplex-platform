# DPX-COMMERCIAL-001 Slice 5 — Commercial Reconciliation Verification

Founder-required artifact, per the Slice 5 authorization:

> Before requesting review, include a Commercial Reconciliation
> Verification showing that, for representative Merchant and Driver
> scenarios: Commission accrued, Commission paid, Outstanding balance,
> Available credit, Current blocked/unblocked status — all reconcile
> exactly with the Commission Ledger and Commission Account. That
> reconciliation will be the final proof that the commercial engine is
> internally consistent before we consider freezing DPX-COMMERCIAL-001.

## 1. Method

`apps/backend/src/commercial/commercial-reconciliation.e2e.spec.ts` — a
new real-Postgres Jest spec, same methodology as every prior slice's
verification. It exercises `CommissionAccountService.accrue()` and
`.recordPayment()` directly — the exact two primitives every real
commercial call site in this codebase goes through:

- Marketplace mode B (`MERCHANT_DIRECT`) and mode C (Cash on Delivery)
  settlement accrual — `MerchantSettlementService` (Slices 2-3).
- Ride cash commission accrual — `RidePaymentService.confirmCash()`
  (Slice 4).
- Admin-manual payment recording — `AdminCommissionAccountsController`
  (Slice 1).

Testing `CommissionAccountService` directly rather than re-running
checkout/ride flows is deliberate: those flows' correct wiring into the
engine is already proven by Slices 2-4's own tests. This document's job
is narrower and specific to the founder's request — prove the engine
itself (ledger math, balance state, blocking rule) is internally
consistent — so it exercises the engine at its own boundary.

For each scenario, after two accruals and one manual payment, an
independent reconciliation function recomputes every value from the raw
`CommissionLedgerEntry` rows (never from `CommissionAccount` fields) and
asserts it against the actual `CommissionAccount` state:

```typescript
const accrued = sum(ledger entries where type = ACCRUAL);
const paid = sum(ledger entries where type = PAYMENT);
const ledgerNet = accrued - paid;
const availableCredit = max(0, creditLimit - outstandingBalance);
const recomputedBlocked = outstandingBalance > creditLimit;
```

Every scenario below asserts `ledgerNet === outstandingBalance` and
`account.blocked === recomputedBlocked` — the two identities that
constitute "reconciles exactly with the Commission Ledger and Commission
Account."

## 2. Merchant scenario

A merchant with a ₦20,000 credit limit, two settlement accruals (mode B
then mode C), then one admin-manual payment.

| Step                                         | Ledger entry    | Outstanding balance | Blocked   |
| -------------------------------------------- | --------------- | ------------------- | --------- |
| Start                                        | —               | ₦0                  | false     |
| Order 701 settles (mode B, Pay to Merchant)  | ACCRUAL ₦12,000 | ₦12,000             | false     |
| Order 702 settles (mode C, Cash on Delivery) | ACCRUAL ₦8,500  | ₦20,500             | **true**  |
| Admin records manual bank transfer           | PAYMENT ₦15,000 | ₦5,500              | **false** |

**Reconciliation** (real values, `commercial-reconciliation.e2e.spec.ts`,
"Merchant scenario" — passing):

| Quantity                               | Value                                          |
| -------------------------------------- | ---------------------------------------------- |
| Commission accrued                     | ₦20,500 (sum of both ACCRUAL entries)          |
| Commission paid                        | ₦15,000 (the one PAYMENT entry)                |
| Ledger net (accrued − paid)            | ₦5,500                                         |
| `CommissionAccount.outstandingBalance` | ₦5,500 — **matches ledger net exactly**        |
| Credit limit                           | ₦20,000                                        |
| Available credit                       | ₦14,500 (= 20,000 − 5,500)                     |
| Current status                         | Unblocked (outstanding ≤ limit)                |
| `CommissionAccount.blocked`            | `false` — **matches recomputed blocking rule** |

The transition through `blocked: true` after the second accrual (₦20,500

> ₦20,000) and back to `blocked: false` after the payment (₦5,500 ≤
> ₦20,000) is asserted explicitly mid-test — proving the blocking rule
> recomputes correctly on both accrual and payment, not just at rest.

## 3. Driver scenario

A driver with the real seed-fallback default credit limit (₦10,000 —
`DEFAULT_DRIVER_CREDIT_LIMIT`, no explicit admin override in this
scenario, same as a driver's very first cash ride in production), two
ride cash commission accruals, then one admin-manual payment.

| Step                                                        | Ledger entry   | Outstanding balance | Blocked   |
| ----------------------------------------------------------- | -------------- | ------------------- | --------- |
| Start (first `getOrCreateAccount()` seeds from the default) | —              | ₦0                  | false     |
| Ride 801 cash confirmed                                     | ACCRUAL ₦4,200 | ₦4,200              | false     |
| Ride 802 cash confirmed                                     | ACCRUAL ₦6,300 | ₦10,500             | **true**  |
| Admin records manual bank transfer                          | PAYMENT ₦2,000 | ₦8,500              | **false** |

**Reconciliation** (real values, `commercial-reconciliation.e2e.spec.ts`,
"Driver scenario" — passing):

| Quantity                               | Value                                          |
| -------------------------------------- | ---------------------------------------------- |
| Commission accrued                     | ₦10,500 (sum of both ACCRUAL entries)          |
| Commission paid                        | ₦2,000 (the one PAYMENT entry)                 |
| Ledger net (accrued − paid)            | ₦8,500                                         |
| `CommissionAccount.outstandingBalance` | ₦8,500 — **matches ledger net exactly**        |
| Credit limit (default)                 | ₦10,000                                        |
| Available credit                       | ₦1,500 (= 10,000 − 8,500)                      |
| Current status                         | Unblocked (outstanding ≤ limit)                |
| `CommissionAccount.blocked`            | `false` — **matches recomputed blocking rule** |

Same round-trip as the Merchant scenario: blocked after the second
accrual (₦10,500 > ₦10,000), unblocked after the payment (₦8,500 ≤
₦10,000).

## 4. What this proves

For both a Marketplace merchant and a Ride driver — the two owner types
every real accrual call site in this codebase writes to — the Commission
Ledger and Commission Account are provably consistent:

1. **Exactly-once, additive ledger.** `outstandingBalance` always equals
   the sum of every `ACCRUAL` entry minus the sum of every `PAYMENT`
   entry, with no drift, in both scenarios.
2. **Blocking is a pure function of ledger state.** `blocked` always
   equals `outstandingBalance > creditLimit`, recomputed correctly on
   both directions of the transition (accrual → blocked, payment →
   unblocked) — not a stale flag.
3. **Available credit is always derivable, never stored.** `creditLimit
− outstandingBalance` (floored at zero) matches what Slice 5's own
   UI surfaces (Merchant Portal, Driver Portal, Admin Portal) compute
   client-side from the same `CommissionAccountDto` fields — no separate
   "available credit" field exists to drift out of sync.
4. **The default credit-limit seed works.** The Driver scenario never
   writes an explicit `CommercialCreditSetting` row before its first
   accrual, and still reconciles against the correct ₦10,000 default —
   proving `getOrCreateAccount()`'s seed-from-effective-limit path
   (Slice 1) is correct, not just the explicit-override path the
   Merchant scenario exercises.

This is the same engine, the same two primitives
(`CommissionAccountService.accrue()` / `.recordPayment()`), already
proven wired correctly into Marketplace settlement (Slices 2-3) and Ride
cash confirmation (Slice 4) by those slices' own tests. This document is
the closing proof the founder asked for: the engine itself, independent
of any one call site, is internally consistent.

## 5. Verification

- `tsc --noEmit` (backend): clean.
- `eslint src/commercial --max-warnings=0` (backend): clean.
- `jest src/commercial/commercial-reconciliation.e2e.spec.ts --runInBand`
  against real Postgres: **2/2 passing** (Merchant scenario, Driver
  scenario).
