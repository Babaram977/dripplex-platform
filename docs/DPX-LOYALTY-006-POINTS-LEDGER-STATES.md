# DPX-LOYALTY-006 — the DX Points ledger becomes auditable

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. What was asked

Nora's policy, 2026-09-11: DX Points are a **separate auditable ledger**, with states
`EARNED / BONUS / REDEEMED / EXPIRED / REVERSED / ADJUSTED`.

## 2. What the ledger was

`LoyaltyLedgerEntry` had `points`, a free-text `reason`, and a `referenceType` string. The only
thing separating one line from another was the sign of `points` and a string comparison — so every
question an auditor actually asks (how much was given away as bonuses, how much was clawed back, how
much did support hand out by hand) could only be answered by pattern-matching text.

Two of the six states had no way to exist at all:

- **REVERSED** — points awarded for an order that was later refunded stayed on the balance forever.
  The money went back; the points did not.
- **ADJUSTED** — support corrections happen anyway, as an engineer running SQL. No endpoint, no
  audit trail, no state anybody could count.

## 3. What shipped

### 3.1 The six states, and a producer for each

| State      | Produced by                                            |
| ---------- | ------------------------------------------------------ |
| `EARNED`   | Orders, deliveries, registration, coupons              |
| `BONUS`    | Milestone achievements — given rather than earned      |
| `REDEEMED` | Wallet cash-out, counter redemption, rewards catalogue |
| `EXPIRED`  | The 365-day sweep                                      |
| `REVERSED` | A refunded order (new)                                 |
| `ADJUSTED` | `POST /admin/loyalty/accounts/:userId/adjust` (new)    |

`BONUS` separated from `EARNED` because the two answer different questions: one is the cost of the
programme working, the other the cost of promoting it. `REVERSED` separated from `REDEEMED` because
the holder did not spend those points — a statement saying they did would be wrong.

### 3.2 Adjustments

Giving support an endpoint makes the correction **visible**, not possible — it was already possible.

- **A positive adjustment does not raise `lifetimePoints`.** Lifetime points drive the tier, and an
  operator handing somebody 5,000 points as an apology must not also hand them a tier they did not
  earn.
- **A negative adjustment is floored at the balance.** A loyalty balance must never go negative: it
  is not a debt anybody agreed to, and the FIFO expiry allocator assumes lots that sum to the
  balance.
- **A reason is required**, because an adjustment nobody can explain later is indistinguishable from
  a bug.

### 3.3 Reversal on refund

Bounded by what is still on the balance, and idempotent on the order. Somebody who has already spent
the points cannot be reversed below zero, and the **shortfall is reported rather than forced** —
the same honest limit as the referral reversal in DPX-REFERRAL-003.

## 4. A deliberate change to live behaviour

**Points awarded for a refunded order are now taken back.** Before this they were kept. Nobody loses
points they earned on an order that stands, and this only fires on `ORDER_REFUNDED`.

## 5. A near-miss worth recording

The first version of the idempotency test passed while the guard that makes it true was **removed** —
it was really asserting that the balance had already reached zero, which it always had in that
fixture. So a replayed refund would have double-reversed as soon as the holder earned anything else,
taking points a different order awarded.

Found by the standing check of deleting each new guard and confirming tests go red. The test now
awards from an unrelated order between the two attempts, and deleting the guard fails it.

### Verification

- 10 database tests: award/redeem typing, bonus separated from earned, an adjustment in its own
  state, an adjustment not granting a tier, a negative adjustment floored at the balance, an
  adjustment refused with no reason or zero points, a refund reversing as REVERSED, reversal
  idempotent across an unrelated earning, a shortfall reported rather than forced, and a refund for
  an order that earned nothing doing nothing.
- 2 subscriber tests: the refund handler wired, and a refund with no order id ignored rather than
  guessed at.
- The migration's backfill was run against rows of every historical shape in a transaction and each
  classification checked (achievement → BONUS, order → EARNED, expiry → EXPIRED, redemption and
  store redemption → REDEEMED), then rolled back.

## 6. Still open

- **Partner earning programmes are not built yet.** Nora's rule that drivers and riders earn only
  under an approved programme, merchants only where a campaign permits, and fleets only via explicit
  incentive programmes — plus the founder's "reviews boost driver DX points but cannot affect the
  star rating" — is the next piece. Today **no partner earns points at all**, which is the safe
  starting state for that rule rather than a contradiction of it.
- **No Ops console screen** for adjustments or for reading the ledger by state.
- **Only order refunds reverse.** A cancelled delivery that already awarded points does not.
