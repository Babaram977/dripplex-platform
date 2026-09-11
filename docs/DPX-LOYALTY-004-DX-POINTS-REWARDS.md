# DPX-LOYALTY-004 — the DX Points rewards catalogue

**Status:** Backend shipped.
**Date:** 2026-09-12

---

## 1. The correction this is built on

Saeed, 2026-09-11: _"point catalogue redemption thresholds be like 10k 25k 50k"_, and Nora's revised
specification is emphatic about why it matters:

> **Do not treat 10,000 or 50,000 DX Points as ₦10,000 or ₦50,000.** They are loyalty-point
> redemption thresholds.

So the thresholds are **rows in a catalogue table**, never constants. Operations can add 5,000 or
75,000 or 100,000 without a deployment, and nothing in the code can quietly turn a points threshold
into a naira amount. The seeded opening catalogue is the founder's three:

| Points | Reward          | Value  |
| ------ | --------------- | ------ |
| 10,000 | Free delivery   | —      |
| 25,000 | Discount coupon | ₦500   |
| 50,000 | Discount coupon | ₦1,500 |

Note the 25,000-point coupon is worth **₦500**, not ₦25,000 — the threshold and the value are
different numbers, and there is a test asserting exactly that so nobody conflates them later.

**Points buy entitlements, never cash.** A reward is a coupon, a free delivery, a gift, a service
benefit. Nothing here pays out naira.

---

## 2. Redemption

Three properties, because a holder is spending something they accumulated over months:

- **Atomic.** The balance check, stock, per-user and total limits, the points debit and the
  entitlement all commit together. A failed redemption leaves the holder exactly as they were —
  there is a test that tries to buy a 100,000-point reward with 60,000 points and asserts the
  balance is untouched and no entitlement exists.
- **Idempotent.** The caller supplies a key, unique per holder at the database level. Two taps on a
  slow connection are one redemption, and a replay returns the original rather than charging again.
- **Stock is claimed conditionally.** A reward with one left cannot be promised to two people racing
  each other: the loser's update matches no row and the whole redemption rolls back.

### Physical gifts are not finished when the points come off

Deducting and forgetting is how somebody ends up having paid 50,000 DX Points for something nobody
ever posted. A gift enters `FULFILMENT_PENDING` and stays on an Operations list through
`PROCESSING → READY_FOR_COLLECTION / SHIPPED → DELIVERED`. Only `DELIVERED` closes it. Digital
rewards — a coupon, a free delivery — are granted instantly and go straight to `FULFILLED`.

### Snapshots

`pointsSpent`, the reward type and its monetary value are **copied onto the redemption**, not read
back from the catalogue. Operations re-pricing a reward must never rewrite what somebody already
paid for it.

---

## 3. Surfaces

| Route                                         | Who                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /customer/loyalty/rewards`               | The catalogue, with what this holder can afford and what they are short of |
| `POST /customer/loyalty/rewards/:id/redeem`   | Spend points, with an idempotency key                                      |
| `GET /customer/loyalty/rewards/redemptions`   | What they have taken                                                       |
| `GET /admin/loyalty/rewards/fulfilment`       | Everything redeemed and not yet handed over                                |
| `PATCH /admin/loyalty/rewards/fulfilment/:id` | Move a gift along                                                          |

### Verification

- 261 suites / 2592 tests green against a fresh, migrate-only, never-seeded Postgres with `CI=true`.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity exact.
- 11 catalogue tests: thresholds are points not naira, points and entitlement move together, a
  repeated request charges once, an unaffordable redemption takes nothing, stock never
  over-promises, the per-user limit holds, a gift enters fulfilment rather than closing, a gift
  closes only on delivery, an inactive reward is refused, affordability is reported per holder, and
  an idempotency key is required.

---

## 4. Still open

- **No Ops UI for the catalogue yet.** Rewards are created and edited through the database or a
  future admin screen; the fulfilment queue has its API but no console page. The redemption engine
  and its guarantees are the part that had to be right first.
- **`DISCOUNT_COUPON` grants an entitlement but does not yet mint a `Promotion`.** The redemption
  records what was bought and its value; wiring it to issue a real coupon the customer can spend at
  checkout or at a merchant's counter is the next step, and the `promotionId` column is already
  there for it.
- **Earning rules are unchanged.** This is the _spend_ side. What earns points, and whether partners
  earn them at all, is DPX-LOYALTY-001 §4 and still open.
