# DPX-COMMERCIAL-001 Slice 4 — Cash Flow Verification (Ride)

Founder-required artifact, per the same instruction issued for Slice 3
and reaffirmed as standing practice when Slice 3 was approved:

> Having an end-to-end narrative proving every monetary movement is
> much more valuable than only relying on unit tests. That document
> should remain part of the permanent commercial documentation.

This walks one concrete, worked example end-to-end through the real
code paths exercised by this slice's own tests
(`ride-payment.service.spec.ts`, `rides.service.spec.ts`), citing the
exact methods and files at each step — the Ride equivalent of
`docs/DPX-COMMERCIAL-001-SLICE-3-CASH-FLOW-VERIFICATION.md`.

**Worked example**: a driver with no prior outstanding commission
balance completes a ride with `totalFare = ₦2,000`. The platform
commission rate is a fixed 15% (`RIDE_PLATFORM_COMMISSION_RATE`,
`ride.constants.ts` — not admin-configurable, unchanged by this slice).
The customer pays cash.

---

## 1. Customer Requests / Rides

Out of Slice 4's scope entirely (dispatch, trip lifecycle — RIDE-002.4
through RIDE-002.6). The ride reaches `RideStatus.COMPLETED` with a
known, locked `totalFare` of ₦2,000. No money has moved — Ride's whole
design is "no money moves during the trip," settlement only happens
once the ride is already complete (`docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md`).

## 2. Customer Selects Cash

`RidePaymentService.initiatePayment(customerId, rideId, 'CASH', ...)`
→ `selectCash()` records `paymentMethod: CASH` on the ride (still
`paymentStatus: PENDING`) and audits
`RIDE_AUDIT_ACTIONS.PAYMENT_INITIATED`. No money has moved — the
customer has committed to paying the driver directly, not DrippleX.

## 3. Customer Pays Cash

At drop-off, the customer hands the driver ₦2,000 cash directly — a
real-world event the backend cannot observe. Nothing in the backend
changes at this exact moment; the ride still shows `paymentStatus:
PENDING` until the driver takes the next step.

## 4. Driver Confirms Collection

The driver calls `POST /driver/rides/:id/confirm-cash` →
`RidePaymentService.confirmCash(driverId, rideId, context)`
(`apps/backend/src/rides/ride-payment.service.ts`):

1. `requireCashConfirmableRide()` — the ride must be `COMPLETED`,
   assigned to this driver, `paymentMethod === CASH`, and not already
   `PAID` (✓ all true for a fresh confirmation).
2. `computeSplit(ride)`: `platformCommission = 2000 × 0.15 = 300`,
   `driverEarning = 2000 − 300 = 1700`.

This is the **Cash confirmation commercial flow** the founder's scope
named — already built in RIDE-002.7, unchanged in shape by this slice.

## 5. Driver Commission Accrual

Still inside `confirmCash()`, before the ride is marked paid:

```
await this.accrueDriverCommissionWithRetry({
  ownerType: CommissionOwnerType.DRIVER,
  ownerId: driverId,          // Ride.driverId is already User.id
  amount: split.platformCommission,   // 300
  referenceType: COMMISSION_REFERENCE_TYPES.RIDE,  // 'ride'
  referenceId: ride.id,
  description: `Commission owed for ride ${ride.id} (cash)`,
});
```

**This is the corrected behavior the whole slice exists to produce.**
Before Slice 4, this ₦300 was written only into an audit-log metadata
field (`RIDE_AUDIT_ACTIONS.CASH_CONFIRMED`'s `platformCommission`
value) — informational, never affecting any real balance, never
blocking anything. Now it is a real, durable liability.

`RIDE_AUDIT_ACTIONS.CASH_CONFIRMED` is still recorded, with the same
metadata plus a new `creditedVia: 'commission_account'` field
(**Audit Trail**, item 1 of 2).

`markPaid()` then flips `paymentStatus: PENDING → PAID`, stores
`platformCommission: 300` and `driverEarning: 1700` on the `Ride` row
(unchanged from RIDE-002.7), records `RIDE_AUDIT_ACTIONS.PAYMENT_SUCCEEDED`
(**Audit Trail**, item 2 of 2), and emits `RIDE_CASH_CONFIRMED`.
**No Wallet mutation happens anywhere in this path** — the driver
already has the ₦1,700 net in physical cash; DrippleX never touched
any of the ₦2,000.

## 6. CommissionAccount Update

Inside `accrueDriverCommissionWithRetry()` →
`CommissionAccountService.accrue()` → `applyMutation()`
(`apps/backend/src/commercial/commission-account.service.ts`):

1. Reads (or lazily creates, seeded with the effective credit limit —
   default ₦10,000) the driver's `CommissionAccount`
   (`ownerType: DRIVER, ownerId: driverId`).
2. Exactly-once pre-check: no existing `CommissionLedgerEntry` for
   `(accountId, referenceType: 'ride', referenceId: rideId)` — none
   found, proceeds.
3. `nextBalance = currentBalance (0) + 300 = 300`.
4. Version-guarded `updateMany({ where: { id, version: 0 }, data: {
outstandingBalance: 300, version: 1 } })` — succeeds. If a
   concurrent cash confirmation for another ride by the same driver had
   won this race instead, `accrueDriverCommissionWithRetry()`'s bounded
   5-attempt loop re-reads the current balance and retries rather than
   failing the confirmation outright (see §8).
5. Creates the `CommissionLedgerEntry` (see §9).

**Result: the driver's `CommissionAccount.outstandingBalance` is now
₦300** — DrippleX is owed ₦300 in commission on this ride.

## 7. Blocking/Unblocking Logic

After the mutation, `recomputeAndPersistBlockState()` reads the
currently-effective credit limit (₦10,000, default for `DRIVER`) and
recomputes `blocked = outstandingBalance > creditLimit`. `300 > 10000`
is `false` — the account stays unblocked. Nothing to audit (blocking
transitions are only recorded when `blocked` actually changes).

**If this driver had ₦9,800 already outstanding** (from prior cash
rides), the new total (₦10,100) would exceed the limit, `blocked` would
flip to `true`, and the very next time this driver calls
`RidesService.updateDriverAvailability(driverId, { online: true, ... })`
(`apps/backend/src/rides/rides.service.ts`), the call would be rejected
with a `ValidationDomainException` — **Automatic credit-limit
enforcement**, the founder-named scope item, verified by this slice's
own test. Going offline (`{ online: false }`) is never blocked — an
already-accepted trip always finishes, and a driver can always take
themselves out of new-work rotation. The driver is automatically
unblocked the moment the balance drops back to ₦10,000 or below (no
automatic-deduction mechanism exists for Ride cash yet — pay-down would
currently be admin-manual only, via the same Slice 1 endpoint already
used for Marketplace).

## 8. Commercial Ledger

The `CommissionLedgerEntry` created in §6 step 5 is the durable,
immutable record:

| field           | value                                      |
| --------------- | ------------------------------------------ |
| `accountId`     | the driver's `CommissionAccount.id`        |
| `type`          | `ACCRUAL`                                  |
| `amount`        | 300                                        |
| `balanceAfter`  | 300                                        |
| `referenceType` | `'ride'`                                   |
| `referenceId`   | the ride's id                              |
| `description`   | `Commission owed for ride <rideId> (cash)` |

No `CommissionLedgerEntry` row is ever updated or deleted — the same
append-only guarantee every other commercial ledger entry in this
codebase carries (Marketplace mode B/C, admin-manual payments).

## 9. Exactly-once Verification

Three guarantees, mirroring Slice 3's structure exactly:

1. **`Ride.paymentStatus` gate** — `requireCashConfirmableRide()`
   rejects a second `confirmCash()` call on an already-`PAID` ride with
   `ConflictDomainException('Ride has already been paid')`, before the
   accrual call is even reached. Tested: "replayed confirmCash on the
   same ride never double-accrues."
2. **`CommissionLedgerEntry` unique `(accountId, referenceType,
referenceId)`** — defense in depth beyond guarantee 1: even if
   `accrue()` were somehow reached twice for the same ride, the second
   call finds the existing ledger entry and no-ops.
3. **Concurrency — two _different_ rides for the same driver
   confirming cash at the same time.** Verified (not discovered — see
   §6 of the correction doc) by the test "concurrent cash confirmations
   for two different rides by the same driver never lose an accrual to
   the shared CommissionAccount race": two rides (₦105 and ₦135
   commission, i.e. 15% of ₦700 and ₦900 fares) confirmed via
   `Promise.all()`, both completed successfully, and the driver's final
   balance is exactly the sum of both — no lost update, no failed
   confirmation.

**Bottom line for the worked example**: ₦2,000 changed hands physically
(customer → driver, never touching DrippleX), and exactly ₦300 of
commercial debt was correctly recorded as owed to DrippleX, via one
accrual, appearing once in the commercial ledger, fully audited, and
safe under concurrent cash-confirmation traffic from the same driver.
