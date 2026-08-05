# DPX-COMMERCIAL-001 Slice 4 — Ride Cash Commercial Correction

## 1. Scope (per the founder's locked instruction)

Founder authorization, recorded verbatim:

> Claude should only address the Ride-side commercial behavior that
> mirrors what Slice 3 corrected for Marketplace. Specifically: Ride
> cash commission accrual; Driver CommissionAccount integration; Cash
> confirmation commercial flow; Automatic credit-limit enforcement;
> Commercial ledger; Exactly-once guarantees; Concurrency testing; Real
> Postgres verification; Cash Flow Verification document. No Ride
> redesign. No Driver redesign. No pricing redesign. No UI redesign
> beyond what is strictly necessary for the approved commercial
> workflow.

Unlike Marketplace COD (Slice 3), Ride's cash-confirmation flow
(`RidePaymentService.confirmCash()`, driver-initiated) already existed
in full — RIDE-002.7 built it, computed the fare split, and marked the
ride paid. The only gap, flagged honestly in that slice's own design
doc, was that the commission figure was audit-only:

> "Cash never enters the digital ledger — the driver already holds it
> physically. Commission is recorded for accounting/audit only; actual
> collection from the driver is a separate, not-yet-built reconciliation
> process (see design doc)."

Slice 4 closes exactly that gap — no new endpoint, no Ride redesign, no
Driver redesign, no pricing change. `RIDE_PLATFORM_COMMISSION_RATE`
(15%, `ride.constants.ts`) is untouched.

## 2. Schema

None needed. `CommissionOwnerType.DRIVER` and
`COMMISSION_REFERENCE_TYPES.RIDE` (`'ride'`) were both already defined
in Slice 1, anticipating this exact call site.

## 3. Driver CommissionAccount integration — commission accrual

`RidePaymentService.confirmCash()` now accrues `split.platformCommission`
onto the driver's `CommissionAccount` (`ownerType: DRIVER, ownerId:
driverId` — `Ride.driverId` is already `User.id`, no resolve step
needed, unlike Marketplace's `MerchantProfile.id` indirection) instead
of leaving it as an audit-log-only figure. Exactly-once via the same
`(accountId, referenceType='ride', referenceId=rideId)` guard every
other commission mutation uses. Wrapped in
`accrueDriverCommissionWithRetry()` — the same bounded 5-attempt retry
pattern Slice 3 established for `MerchantSettlementService`, applied
proactively here rather than reactively (see §6).

## 4. Cash confirmation commercial flow

No new endpoint — `confirmCash()` (`POST` via `DriverRidesController`)
already existed and already gates on the ride being `COMPLETED`, driver-
owned, cash-selected, and not already paid
(`requireCashConfirmableRide()`). Slice 4 only adds the accrual call
inside it, before the ride is marked paid, plus a `creditedVia:
'commission_account'` field in the existing `CASH_CONFIRMED` audit
metadata so the audit trail reflects the corrected behavior.

## 5. Automatic credit-limit enforcement

`RidesService.updateDriverAvailability()` already gated going online on
identity verification (Driver-001/DPX-DS-001). The same shape of check
is added right after it, only when `dto.online === true`: resolve the
driver's `CommissionAccount` and reject with a `ValidationDomainException`
if `blocked === true`. Going offline is never blocked — same as the
identity-verification gate beside it. No new module wiring beyond
importing `CommercialModule` into `RidesModule`.

## 6. Concurrency — verifying, not (this time) discovering

Slice 3 discovered a real bug: `CommissionAccountService.accrue()`
has no retry of its own, so two concurrent accruals on the same account
could race on its optimistic-concurrency version and fail outright. That
fix (`accrueCommissionWithRetry()`/`reverseAccrualWithRetry()`) was
applied to `MerchantSettlementService`. Slice 4 applies the identical
pattern proactively to `RidePaymentService` (as
`accrueDriverCommissionWithRetry()`) before writing any test — the same
race is exactly as possible here (two different cash rides for the same
driver completing close together). The concurrency test in this slice
verifies the pattern holds for a second, independent call site rather
than discovering a new defect: two concurrent `confirmCash()` calls for
two different rides by the same driver both complete successfully, and
the driver's final `CommissionAccount.outstandingBalance` is exactly
the sum of both commissions — no lost update.

**Honest, out-of-scope observation (not fixed here)**: `confirmCash()`'s
own idempotency relies on `requireCashConfirmableRide()`'s
`paymentStatus !== PAID` check, which is a plain, unlocked read —
two concurrent `confirmCash()` calls for the _same_ ride could both pass
that check before either commits `markPaid()` (no optimistic-concurrency
guard on `Ride` itself). This is pre-existing RIDE-002.7 behavior, not
introduced by Slice 4, and the founder's "no Ride redesign" instruction
means fixing it is out of this slice's mandate. It does not threaten the
commission accrual's own correctness: `accrue()`'s independent
`(accountId, referenceType, referenceId)` ledger guard makes a second
accrual for the same ride a safe no-op regardless of any race in
`markPaid()`. Flagged here in the spirit of Slice 2/3's own honest-gaps
sections, not silently ignored.

## 7. Commercial ledger & audit trail

Reused entirely from Slice 1/3 — `CommissionAccountService.accrue()`
creates the same append-only `CommissionLedgerEntry`
(`type: ACCRUAL`), and `recomputeAndPersistBlockState()` records
`COMMERCIAL_AUDIT_ACTIONS.BLOCKED`/`UNBLOCKED` on every transition. No
new ledger or audit infrastructure needed.

## 8. Tests

Real-database (same methodology as Slice 3):

- `ride-payment.service.spec.ts` — new `DPX-COMMERCIAL-001 Slice 4`
  describe block: commission accrues onto the driver's
  `CommissionAccount` on cash confirmation; a replayed `confirmCash()`
  on the same ride is rejected by the ride's own `paymentStatus` gate
  and never double-accrues; **concurrent cash confirmations for two
  different rides by the same driver** never lose an accrual (the
  proactive concurrency test — §6). Added a file-level `afterEach` that
  resets the shared driver's `CommissionAccount`, the same test-hygiene
  fix Slice 3 applied to `merchant-settlement.service.spec.ts`.
- `rides.service.spec.ts` — new `DPX-COMMERCIAL-001 Slice 4` describe
  block: a driver whose `CommissionAccount` is blocked is rejected when
  going online, but going offline always succeeds regardless.
- `ride-lifecycle.e2e.spec.ts` / `rides.service.spec.ts` /
  `ride-payment.service.spec.ts` constructor call sites updated for the
  new `CommissionAccountService` dependency.

## 9. Full verification

- `tsc --noEmit` (backend): clean.
- `eslint src --max-warnings=0` (backend): clean.
- `jest --runInBand` (full backend suite): **1300/1303** passing. The
  same 3 pre-existing, unrelated failures as every prior slice's
  verification round (`operations-cases.service.spec.ts`'s `vehicleId`
  FK fixture-drift test, and two `customer-products.service.spec.ts`
  fixture-count assertions) — confirmed via `git status` that this
  session touched neither `operations/` nor `products/`.

## 10. What Slice 4 deliberately does not do

- Does not fix the `confirmCash()`-on-the-same-ride race described in
  §6 — pre-existing, out of "no Ride redesign" scope, and not a threat
  to the commission accrual's own correctness.
- Does not build a rider-earning-equivalent gap for Ride — Ride's
  `payoutDriver()` already credits the driver's Wallet for every
  digitally-paid (non-cash) ride; that was never the gap. Only the cash
  path's commission was audit-only, and that's what's fixed.
- Does not touch pricing, `RIDE_PLATFORM_COMMISSION_RATE`, or any UI.
- Does not reconcile the mode-A-deduction-refund gap (Slice 2 §5.6) —
  still deferred pending its own founder-scoped decision, unrelated to
  Ride.

## 11. ✅ Founder Review — Approved (2026-08-05)

> DPX-COMMERCIAL-001 Slice 4. Status: ✅ Approved. This slice achieved
> exactly what I wanted: it completed the commercial accounting without
> redesigning the Ride platform... [accrual, CommissionAccount reuse,
> preserved confirmCash() flow, credit-limit enforcement, ledger/audit,
> concurrency — each individually approved]... I actually like that this
> slice didn't discover another bug. Instead, it proved that the retry
> strategy introduced earlier generalizes correctly. That increases
> confidence in the commercial engine... [on the pre-existing
> confirmCash() race] That is not a DPX-COMMERCIAL-001 issue. It belongs
> to Ride's payment implementation. Documenting it rather than quietly
> redesigning Ride was the correct decision... Like Slice 3, this
> becomes permanent commercial documentation. Those cash-flow narratives
> will be valuable later during finance, audit and compliance reviews.

## 12. Next step

Slice 5 (Commercial Visibility) is founder-authorized — see
`docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-VISIBILITY.md`.
