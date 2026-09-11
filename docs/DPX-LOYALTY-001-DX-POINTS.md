# DPX-LOYALTY-001 — DX points become money

**Status:** Slice 1 shipped (points economy). Slices 2–3 blocked on founder input, below.
**Date:** 2026-09-11

---

## 1. Founder decisions (locked)

Given by the founder on 2026-09-11:

| #   | Decision                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | **200 DX points = ₦1.**                                                                                                  |
| 2   | Points give a **discount on transactions at merchant physical stores**.                                                  |
| 3   | **Drivers, riders, fleet owners and merchants get a lower commission** as a points benefit.                              |
| 4   | A customer reaching **10,000 points** gets **delivery-fee discounts**, the size of which is **set up during campaigns**. |
| 5   | A customer reaching **50,000 points in the same month** gets **free delivery, physical gifts and coupons at checkout**.  |
| 6   | **Points expire 365 days** after they are earned.                                                                        |

Decisions 1, 4 (the threshold), 5 (the threshold) and 6 are implemented. Decisions
2, 3 and the _benefit sizes_ in 4 and 5 are not — see §4.

---

## 2. What the module was before this slice

Verified against the code, not against a prior report:

| Claim                            | Reality in the code                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Points are awarded               | **True.** `LoyaltyEventsSubscriber` awards on `ORDER_PAID` (+50), `DELIVERY_COMPLETED` (+25), `CUSTOMER_REGISTERED` (+100) and `COUPON_REDEEMED` (+10), and all four events are genuinely emitted (`registration.service.ts:280`, `delivery.service.ts:417`, `merchant-orders.service.ts:238`, `payment.service.ts:758`, `checkout.service.ts:228`, `promotions.service.ts:802`). |
| Points can be redeemed           | **False in substance.** `redeemPoints` deducted the points, wrote a ledger line reading "Redeemed loyalty points for discount", and **paid nothing** — no discount existed anywhere in the platform. A customer redeeming was simply destroying their balance.                                                                                                                    |
| Points expire after 365 days     | **False.** `expiresAt` was written correctly on every award, but `expirePoints` had **no caller anywhere in the codebase**. Nothing had ever expired.                                                                                                                                                                                                                             |
| Expiry arithmetic is correct     | **False.** It expired `min(entry.points, account.pointsBalance)` — the size of the due award capped at the _account_ balance, with no regard for whether that award had already been spent. A customer who earned 100 in January and 100 in June and spent 150 had 50 left, all of it June's; when January fell due, 50 points were destroyed five months early.                  |
| A rewards screen exists          | **True**, in `apps/customer-web` — tier bar and cashback list. It showed no points balance, no rate, no expiry and offered no redemption.                                                                                                                                                                                                                                         |
| `awardCashbackPoints` is used    | **False.** No caller. Unchanged by this slice.                                                                                                                                                                                                                                                                                                                                    |
| The SDK redeem contract is right | **False.** `RedeemLoyaltyPointsRequest` declared `reason` (required), `referenceType` and `referenceId`. The endpoint's DTO has only ever had `points`, and the global pipe runs `forbidNonWhitelisted` — so any caller that filled those fields in got a 400.                                                                                                                    |

---

## 3. What this slice ships

**Points are worth money.** `POST /customer/loyalty/redeem` converts points into
the customer's own wallet balance at 200:1, which makes a point spendable
everywhere the wallet already works — rides, deliveries, orders, transfers,
payouts. Redemptions are whole naira only; the endpoint refuses anything that is
not a multiple of 200 rather than rounding a fraction away from the customer, and
the app shows the exact redeemable figure so nobody has to guess.

**The two ledgers cannot come apart.** The points debit and the wallet credit
commit in a single transaction (`WalletService.creditWithin`), and the credit is
keyed on the loyalty ledger row that paid for it, against the existing unique
index on `(wallet_id, reference_type, reference_id)`. A retry pays once. The
wallet's audit record and domain event are published _after_ the commit, never
inside it.

**Expiry runs, and takes only what is actually there.** `LoyaltyExpirySweepService`
calls `expirePoints` hourly (the same `setInterval` pattern as
`PromotionSweepService` — this codebase has no `@nestjs/schedule`). Consumption is
oldest-first, replayed from the ledger by a pure function (`points-lots.ts`), so an
award that has already been spent expires nothing. There is no cliff risk in
switching this on: `expiresAt` has been written on every award from the start,
always a year out, and DrippleX is well short of a year old, so the first sweeps
find nothing due.

**The accumulation rules are legible.** `GET /customer/loyalty` now carries a
`points` block — balance, the rate, what it is worth, what can be redeemed now,
points earned this calendar month (Lagos time, not UTC), the next expiry date and
how much goes with it, and progress against both founder thresholds. The customer
Rewards screen renders it; every figure is computed by the backend, so the rate and
the thresholds are stated in exactly one place.

### Verification

- 253 suites / 2503 tests green against **real Postgres and Redis**, not skipped.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18.
- The expiry fix has a regression test at both levels. Reverting the one line back
  to `min(entry.points, account.pointsBalance)` turns **2 tests red** (the unit
  case and the database case); restoring it turns them green.
- Redemption has a database-backed spec proving the two ledgers agree, that a
  refused redemption takes nothing, and that a replayed credit pays once.

---

## 4. Open — needs founder input before it can be built

Per the engineering playbook these are recorded rather than guessed at.

### 4.1 Lower commission for drivers, riders, fleet owners and merchants

The decision is locked; **the numbers are not given**. Commission today is two
platform-wide singletons — `PlatformCommissionSetting.commissionRate` (10%, used
for the rider/driver delivery-fee split) and `MerchantCommissionSetting.commissionRate`
(10%). Making it a loyalty benefit makes the effective rate per-partner.

Needed before building: **how much lower, and against what.** Concretely, a
reduction per loyalty tier (BRONZE/SILVER/GOLD/PLATINUM/VIP) for each of the four
personas — e.g. "GOLD drivers pay 9% instead of 10%". Whether the reduction should
be the same for all four personas is also open.

Also open: partners currently earn no points at all. Every award rule in
`LOYALTY_EVENT_POINTS` is customer-side. A commission benefit keyed on a partner's
tier needs partners to accrue — on completed jobs, on settled orders — and no such
rule has been decided.

### 4.2 Delivery-fee discount at 10,000 points

Threshold given, and eligibility is live in the API today. The **size** of the
discount is explicitly a campaign setting, and `ReferralCampaign` has no field for
it — campaigns are currently driver-referral campaigns with reward amounts, not
loyalty benefit campaigns.

Needed: whether this is a percentage or a flat naira cap, and whether it applies
per delivery or per month.

### 4.3 The 50,000-in-a-month tier

Threshold given and live in the API. Of the three rewards named:

- **Free delivery** — implementable once §4.2 settles how a loyalty benefit is
  attached to a campaign; it is the same mechanism at 100%.
- **Coupons at checkout** — implementable against the existing promotions module,
  which already issues and redeems coupons. Needs a decision on value and count.
- **Physical gifts** — **a dependency, not a feature.** There is no inventory,
  fulfilment, address-for-delivery or redemption-tracking machinery anywhere in the
  platform. This cannot be built as loyalty work; it needs its own scope.

### 4.4 Discount at merchant physical stores

Decision 2 has no implementation path yet. DrippleX has no in-store/point-of-sale
transaction flow — merchant orders are placed through the app. An in-store
discount needs a way for a physical store to identify the customer and apply it
(a scannable code, a merchant-side lookup), and none exists.

---

## 5. Not addressed by this slice

- `awardCashbackPoints` still has no caller.
- Loyalty **tiers still do nothing** beyond displaying a label and a progress bar.
  §4.1 is what would give them meaning.
- Partner personas (driver, rider, fleet, merchant) accrue no points.
