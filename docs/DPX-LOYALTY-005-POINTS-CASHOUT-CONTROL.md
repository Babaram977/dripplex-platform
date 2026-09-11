# DPX-LOYALTY-005 — the cash-out, as shipped but controllable

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. The decision

Nora's policy §7 held that DX Points must not be treated as cash, which sat against a shipped
endpoint — `POST /customer/loyalty/redeem` — that converts points to withdrawable wallet cash at
200:1. That conversion was itself a founder decision, so it was reported rather than changed.

**Founder decision, 2026-09-11:** _"Let it be as shipped but can be controlled."_

So nothing about today's behaviour changes. 200 points still buy ₦1, the cash-out is still on,
in-store spending is still on, there is still no daily cap. What changes is that every one of those
stops being a constant that needs a deployment to move.

That is §7 answered by a handle rather than by deleting a feature. Operations can close the cash
door and leave points fully spendable in store and against the rewards catalogue, or narrow it with
a daily cap — the setting between "points are cash" and "points are not cash at all" — without
anybody shipping code.

## 2. What shipped

`LoyaltySetting`, one row, the same fixed-id singleton pattern as `PlatformCommissionSetting`:

| Setting                    | Seeded | What it does                                                        |
| -------------------------- | ------ | ------------------------------------------------------------------- |
| `pointsPerNaira`           | 200    | The conversion rate                                                 |
| `walletRedemptionEnabled`  | true   | Whether points may become withdrawable wallet cash at all           |
| `storeRedemptionEnabled`   | true   | Whether points may be spent at a merchant's counter                 |
| `minRedemptionPoints`      | 200    | The smallest cash-out                                               |
| `dailyRedemptionPointsCap` | null   | The most one holder may cash out in a rolling 24 hours; null is off |

Every default is the constant it replaced. The seed is in the migration rather than left to
first-touch, so the row an operator edits exists the moment this deploys and its values are visible
in the migration rather than only in code.

`GET` / `PATCH /admin/loyalty/settings`, under the existing `admin:loyalty:manage` permission — no
new permission, because this is the same authority over the same thing.

### Details worth knowing

- **The customer summary now says whether the cash-out is open.** A screen offering a button that
  will be refused is worse than one that does not offer it, so `walletRedemptionEnabled` is served
  on `GET /customer/loyalty/summary` alongside the live `pointsPerNaira` and minimum.
- **The daily cap is a rolling 24 hours, not a calendar day.** A midnight boundary would let
  somebody take two days' worth in a few minutes, which is what a cap exists to stop. Counted off
  the loyalty ledger, which is where a redemption is recorded first.
- **The rate is snapshotted on every redemption.** Re-pricing points is a forward-looking decision;
  a redemption already made is money already moved. There is a test asserting a wallet balance is
  untouched by a later re-pricing.
- **A till code keeps the rate it was issued at.** The in-store payout recovers the rate from what
  the code actually promised rather than reading the setting fresh, so a re-pricing between a
  customer showing a code and a merchant typing it cannot change what the merchant is paid.
- **A minimum that is not a whole number of naira is refused.** The redeem path requires multiples
  of the conversion rate, so such a minimum would refuse every redemption — no amount could satisfy
  both rules. Checked against the merged values, because either field can be the one that breaks it;
  an operator changing both at once is allowed, changing one into an impossible pair is not.
- **Changing the rate is audited with the figure before and after**, as are both switches and the
  cap. It re-prices every unspent balance on the platform at once.

### Verification

- 10 database tests: the seeded state matching what was already live, 200 points still buying ₦1,
  the cash-out closing without touching a balance, the summary reporting it closed, a re-priced rate
  taking effect, a rolling cap enforced across separate redemptions and still allowing the
  remainder, an impossible minimum refused from both directions, a non-integer rate refused, and an
  earlier redemption's value surviving a re-pricing.
- Proven load-bearing: removing the switch and the cap check turns 2 of them red.

## 3. In-store spending is untouched

The founder's instruction was explicitly not to change in-store spending, and a switch seeded on
does not change it. `storeRedemptionEnabled` exists so the two doors can be operated separately —
which is the whole point, since the §7 concern is about cash-out specifically and not about a
customer spending points in a shop.

## 4. Still open

- **No Ops console screen.** The API takes these settings; there is no page. Given the conversion
  rate re-prices every balance on the platform, that screen should show the blast radius — how many
  points are outstanding and what they are currently worth — before it accepts a change.
- **The cap is per holder, not platform-wide.** There is no control over what the cash-out costs
  DrippleX in total, which is the same gap `budgetAmount` closed for campaigns in DPX-CAMPAIGN-001.
- **No notice to holders when the cash-out closes.** They find out when they try.
