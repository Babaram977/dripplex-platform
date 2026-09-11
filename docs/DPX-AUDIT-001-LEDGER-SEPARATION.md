# DPX-AUDIT-001 — does promotional and reward logic contaminate the settlement ledgers?

**Status:** Audit complete. The finding is **resolved** — see §3. A second, larger bug was found while fixing it.
**Date:** 2026-09-11

---

## 1. What was audited, and against what

Nora's principle, 2026-09-11:

> Never let promotional/reward logic contaminate the core merchant, driver or fleet settlement
> ledger.

This audit reads the code for every place value moves, and asks one question of each: **does a
discount, a point or a reward change what a partner is settled, or what they are billed?**

A note on scope. I audited the seven ledgers this platform actually keeps, listed below, against the
principle as quoted. Where Nora's original enumeration differs from mine, the ledgers are what they
are — this covers every table money touches.

| #   | Ledger                                                            | Kind        |
| --- | ----------------------------------------------------------------- | ----------- |
| 1   | `OrderSettlement` — merchant marketplace settlement               | Settlement  |
| 2   | `Ride.platformCommission` / `driverEarning`                       | Settlement  |
| 3   | `DeliveryJob` rider settlement                                    | Settlement  |
| 4   | `FleetCommissionPeriod` / fleet receivables                       | Settlement  |
| 5   | `CommissionAccount` / commission ledger                           | Settlement  |
| 6   | `Wallet` / `WalletLedgerEntry`                                    | Money held  |
| 7   | `LoyaltyLedgerEntry`, `PromotionRedemption`, `ReferralRedemption` | Promotional |

**Nothing in this document changes behaviour.** The one finding moves money in a live partner's
direction, so it is reported for a decision rather than fixed.

---

## 2. Clean — six of seven

### 2.1 Merchant settlement is computed before any discount ✓

`MerchantSettlementService` settles on `Number(order.subtotal)`, and `subtotal` is the sum of cart
item subtotals — **set before any coupon**. `PricingService.computeTotals` applies the discount only
against `subtotal` when producing `total`, and stores it in its own `discount` column.

So a customer coupon never reduces what the merchant is paid. DrippleX absorbs it.

### 2.2 The ride split is computed on the gross fare ✓

The strongest case, and already documented in the code as DPX-PROMO-FUNDING. `ride.totalFare` is
stored **discounted** (`estimate.totalFare − promoDiscount`), and `computeSplit` deliberately adds
the discount back:

```ts
const grossFare = this.roundCurrency(charged + promoDiscount);
```

The comment there records exactly why, and it is worth repeating because it is the template for
every other case: splitting on the discounted fare made a ₦500 coupon cost the driver ₦450 and the
platform ₦50 — _the platform's marketing spend billed to the driver in the commission ratio, without
their knowledge_. A driver who never saw the coupon had no way to notice.

### 2.3 Rider settlement cannot currently be contaminated ✓ (but see §4)

`RiderSettlementService` settles on `job.deliveryFee`, and `PricingService` never discounts the
delivery fee — the coupon is clamped to the subtotal. There is also no promotion path for the
`DELIVERY` domain at all (DPX-LOYALTY-008 §3).

Clean **today**, and for a reason that is about to change. See §4.

### 2.4 No reward or promotion ever accrues to a commission account ✓

There are exactly four callers of `CommissionAccountService.accrue`, and all four are core
settlement: rider, merchant, fleet, ride. No loyalty, referral, promotion or campaign path touches
the commission ledger.

### 2.5 Rewards are paid in wallet money, never settlement money ✓

Every reward lands on the wallet ledger under its own reference type, and none touches a settlement
row:

- Referral rewards → `referral_referrer_reward` / `referral_referee_reward`
- Driver growth campaign → the DRIVER wallet
- In-store DX Points → `LOYALTY_STORE_REDEMPTION` on the merchant wallet
- In-store coupons → `LOYALTY_STORE_COUPON` on the merchant wallet

### 2.6 The promotional cost is recorded, and now budgeted ✓

`PromotionRedemption.amountSaved` records what each discount cost, on the promotions ledger and
nowhere else.

**An item previously open in DPX-LOYALTY-003 has closed as a side effect**: that doc noted the
in-store coupon discount "is not yet booked as a marketing cost against the campaign that granted
it". Since DPX-CAMPAIGN-001, `redeemForReference` increments `budgetSpent` — and the in-store coupon
path goes through `redeemForReference`. So counter coupons now do count against their campaign's
budget. No work needed; recorded here so the open item can be struck.

---

## 3. ✅ Resolved — fleet commission was billed on the discounted fare

**Founder decision, 2026-09-11: fix it.** `FleetJobSubscriber` now counts
`ride.totalFare.add(ride.promoDiscount)` — the gross fare, matching the driver split beside it.
Added as Decimals rather than numbers, because these are money and two float additions of a fare and
a discount is how a month's total drifts a kobo at a time.

**What fixing it uncovered is the more serious half. See §3.1.**

The finding as reported:

**`FleetJobSubscriber` counts a ride into a fleet's month using `ride.totalFare`, which is the
discounted fare.** The driver's own split, computed a few files away, deliberately uses
`totalFare + promoDiscount`.

```ts
// fleet-job.subscriber.ts — the fleet's chargeable total
return { userId: driverId, amount: ride.totalFare, at: ride.completedAt };
```

So on a fleet driver's discounted ride:

- The **driver** is paid on the gross fare. Correct — fixed by DPX-PROMO-FUNDING.
- The **fleet** is billed commission on the _discounted_ fare. Promotional value has reached the
  fleet settlement ledger.

### Which way it cuts

**In the fleet's favour.** At a ₦500 coupon and a 10% band, the fleet is under-billed by ₦50 on that
ride. No partner is being over-charged; DrippleX is collecting less commission than the work
generated, quietly, and inconsistently with the ride ledger sitting beside it.

### Why I have not fixed it

Correcting it **raises invoices for live fleet partners**. The principle is already settled — the
ride path decided that a split is computed on gross — so this is arguably just making the fleet
ledger consistent with a decision already made rather than a new one. But it is money out of a real
company's pocket, and a partner noticing their bill went up without being told is worse than the
inconsistency.

**Recommendation:** align it — pass `totalFare + promoDiscount` — and tell affected fleets before the
month it lands in. One line of code; the decision is whether and when, not how.

### 3.1 ⚠⚠ The bug underneath: fleet commission has never been counted at all

Writing the first test this subscriber has ever had produced a chargeable total of **zero**, for a
ride that plainly should have counted.

`DomainEventBus` hands a handler the whole `DomainEvent` — `{ name, payload, occurredAt }`.
`FleetJobSubscriber` named its parameter `payload` and destructured the job fields straight off it:

```ts
this.eventBus.on(DOMAIN_EVENTS.RIDE_COMPLETED, async (payload: unknown) => {
  await this.handleRideCompleted(payload); // reads `rideId` off the wrapper
});
```

`rideId` and `deliveryJobId` therefore came back `undefined`, every handler returned at its first
guard, and nothing was ever recorded. **Both branches — rides and deliveries.** Every fleet's
`chargeableTotal` has been zero since this shipped, so no fleet has ever been billed commission.

It was silent for three reasons stacked on each other: the guard is an ordinary early return rather
than an error; `count()` swallows exceptions by design, so nothing would have surfaced even if it had
thrown; and the subscriber had **no test at all**. The gross-versus-net question was a rounding
error on top of a ledger that was never being written.

Every other subscriber on this bus reads `event.payload` correctly — this one was the only
exception, confirmed by grep.

**Fixed**, and both fixes are independently proven: reverting the gross fare fails one test,
reverting the payload read fails two.

**This one does need telling.** Fleets have been under-billed by everything, not by a coupon's
worth. What is owed for past months cannot be recovered from `chargeableTotal` — those rows are
empty — but it is reconstructable from the rides and delivery jobs themselves, which are all still
there. That is a decision and a piece of work, not something to quietly start charging for.

The delivery branch of the same subscriber uses `job.deliveryFee` and needs no gross/net change,
because nothing discounts a delivery fee today.

### 3.2 What each fleet owes for the lost months is now computable

The counts are gone; the work is not. Every ride and every delivery job is still on the record with
its fare, its fee, its completion time and who did it, so each month is recomputable from source.
`FleetCommissionBackfillService` does that, and `GET /admin/fleets/commission/reconstruction`
reports it.

It is deliberately a **report** by default. `?apply=true` is opt-in, because the first thing anybody
should do with this is look at it. Four rules, each because getting it wrong bills a real company
the wrong amount:

| Rule                                     | Why                                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A settled month is never touched         | An invoice that has gone out is a number somebody agreed to. A shortfall there is reported and left for a human.                                                                                          |
| It sets rather than increments           | It sees the whole month, so re-running it lands on the same number instead of doubling a fleet's bill.                                                                                                    |
| Membership is read as it was at the time | `joinedAt`/`removedAt` are both on the row. Reading today's membership would drop the work of everybody who has since left — over months of history, exactly the population most likely to have moved on. |
| Rides count on the gross fare            | Same basis as the live path and DPX-PROMO-FUNDING: DrippleX funds its own coupons.                                                                                                                        |

Ten tests cover it, and all seven guards are mutation-proven — each one deleted in turn reddened
exactly one test, and the suite was confirmed green again after each restore.

Known limit, stated rather than papered over: a deactivation is not recorded historically, only as a
current flag, so a job done during one would still count. Deactivating stops DrippleX dispatching to
that person, so there should be no such jobs; if there are, they were real work the fleet's rider
did.

**Still a founder decision, not a technical one:** whether and when to actually bill fleets for the
reconstructed months. The tooling makes the number knowable. It does not make the charge agreed.

### 3.3 A fleet is now answered as an entity in its own right

Found while wiring the above. `PartnerPositionService.getPosition` mapped `CommissionOwnerType` to
`WalletOwnerType` through a ternary whose final branch was `RIDER`, and `FLEET` fell into it. So the
console looked up a `User` by a fleet id, found nobody, and rendered a nameless partner with an
empty wallet and no pending payouts — while that fleet's commission balance, and the money DrippleX
owed it, were both real.

A fleet is a company, and three things about it are genuinely different. It has a company name and a
DX number rather than a person's name; it holds **no wallet**, so its claim on DrippleX is the
remaining balance on its approved `FleetSettlementReceivable` rows; and it asks for money through
`FleetSettlementRequest`, not a `WithdrawalRequest` filed by a user. Each is now answered from the
fleet's own records. Reporting ₦0 because there is no `Wallet` row would have said DrippleX owes it
nothing, which is a different and usually false claim.

---

## 4. The same trap, waiting

**When free delivery is built, it must not reduce `DeliveryJob.deliveryFee`.**

The 10,000-point free-delivery reward cannot be spent today because no code consults promotions for
the `DELIVERY` domain (DPX-LOYALTY-008 §3). Whoever builds that path will reach for the obvious
implementation — reduce the fee — and that is exactly the bug the ride path already had and fixed:
the rider would fund DrippleX's reward out of their own earnings, in the commission ratio, without
ever seeing the coupon.

The correct shape is the one `computeSplit` already uses: settle the rider on the **gross** delivery
fee and record the discount separately as a marketing cost.

Recorded here because the trap is invisible at the moment somebody walks into it.

---

## 5. Summary

| Ledger                          | Verdict                                              |
| ------------------------------- | ---------------------------------------------------- |
| Merchant settlement             | ✓ Clean — settled pre-discount                       |
| Ride settlement                 | ✓ Clean — split on gross, documented                 |
| Rider settlement                | ✓ Clean today — see §4 before building free delivery |
| **Fleet settlement**            | **⚠ Billed on the discounted fare — §3**             |
| Commission accounts             | ✓ Clean — no reward path accrues                     |
| Wallet                          | ✓ Clean — rewards land under their own types         |
| Promotional / points / referral | ✓ Separate, costed, and now budgeted                 |

The audit's own finding was a coupon's worth of under-billing. Fixing it surfaced that the fleet
ledger was never written at all — which is the finding that actually matters, and the one that needs
a decision about past months.
