# DPX-CAMPAIGN-001 — a campaign gets a budget

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. What was asked

Nora's Rewards, Campaign & Referral policy, 2026-09-11, on campaign configurability:

> budgets, min/max benefit, fixed or percentage, per-user and per-device limits, minimum
> transaction, maximum discount, eligible merchants and categories, total redemption limit.

## 2. What already existed — verified against the code, not assumed

Most of that list has been in the promotions engine since DPX-CORE-002:

| Asked for              | Already there               |
| ---------------------- | --------------------------- |
| Fixed or percentage    | `amountOff` / `percentOff`  |
| Maximum discount       | `maxDiscount`               |
| Per-user limit         | `perUserLimit`              |
| Per-device limit       | `perDeviceLimit`            |
| Minimum transaction    | `minOrderAmount`            |
| Total redemption limit | `usageLimit` / `usageCount` |
| Eligible categories    | `rules.merchantCategories`  |

Three things genuinely were not there, and this ships those three. Nothing already working was
rebuilt.

## 3. What this ships

### 3.1 Budgets — the only control that bounds spend

`budgetAmount` and `budgetSpent` on `Promotion`.

`usageLimit` bounds how many times a campaign is used, which is **not** the same thing as what it
costs. Ten thousand redemptions of "20% off" costs whatever ten thousand baskets happen to add up
to, and nobody knows that number in advance. A campaign could be within every limit it had and still
cost an unbounded amount.

`budgetSpent` is incremented by each redemption's `amountSaved` **inside the same locked,
Serializable transaction that records the redemption**, so the running total cannot drift from the
redemptions it is the sum of, and two simultaneous checkouts cannot both spend the last of the
budget. It is not settable through the API: a figure an operator can type over is not a record of
anything.

**A redemption that would exceed the budget is refused, not trimmed.** Quoting somebody ₦500 off and
taking ₦120 because the campaign is nearly out is worse than being told the offer has ended, and it
puts a number on a receipt that matches nothing the campaign ever advertised.

The budget is also checked at **preview**, so a customer is not shown a discount that will be
refused at the till. The redemption check remains the real one — the preview read is not locked.

### 3.2 A benefit floor

`minDiscount`, beside `maxDiscount`'s ceiling. "₦200 to ₦2,000 off" is a real offer; 10% of a ₦500
basket is ₦50, which delivers a worse impression than no campaign at all.

Three rules about the floor, all tested:

- It is applied **after** the ceiling, so a misconfigured campaign where the floor exceeds the
  ceiling resolves to the floor rather than to something matching neither.
- It never lifts a discount above the subtotal. Nothing gives ₦200 off a ₦150 order — the one clamp
  here that protects the merchant rather than the customer.
- A benefit of zero never reaches it. A campaign that does not apply must not be turned into one
  that does by a floor.

### 3.3 Named merchants

`rules.eligibleMerchantIds`. Categories answer "every restaurant"; this answers "these four shops we
agreed it with", which is how a co-funded campaign is actually scoped. Distinct from
`Promotion.merchantId`, which says who _owns_ a merchant-funded promotion rather than where it can be
spent.

It fails closed like every other rule in that evaluator: a campaign restricted to named merchants
does not apply on a path that cannot say which merchant it is.

**Commission campaigns reuse this same rule vocabulary**, so `CommissionRateContext` gained
`merchantId` and the merchant-order settlement path now supplies it. Without that wiring, a
commission campaign aimed at named merchants would have failed closed silently and never applied —
an advertised control that can never fire is worse than no control.

### Verification

- 7 database tests: a budget exhausting and stopping the campaign, a redemption over headroom refused
  rather than trimmed, an uncapped campaign staying uncapped while still recording its cost,
  `budgetSpent` reconciling exactly against the sum of its redemptions, the floor lifting a small
  percentage benefit, the floor never exceeding the basket, and named-merchant scoping including its
  fail-closed case.
- Proven load-bearing: removing the budget assertion turns 2 of them red.
- The migration's backfill was run against real redemption rows in a transaction and checked to
  reconcile (₦400 + ₦250.50 → ₦650.50; a campaign with no redemptions stays at zero), then rolled
  back.

## 4. Migration safety

Every column is nullable or zero-defaulted, so each campaign already running keeps behaving exactly
as it does today: uncapped budget, no floor.

The migration **backfills `budget_spent` from existing redemptions**. Without that, setting a
₦500,000 budget tomorrow on a campaign that has already given away ₦400,000 would authorise
₦900,000.

## 5. Still open

- **No Ops console field** for the budget or the floor yet — the API takes them, the promotions
  screen does not show them. Until then a budget can only be set through the API.
- **No alert as a budget nears exhaustion.** A campaign stops paying out the moment it is spent, and
  the first anyone hears of it is a customer being refused. `budgetRemaining` is served on the DTO
  for whatever surfaces this.
- **Budget is per campaign, not per period.** "₦500,000 a month" needs either a new campaign each
  month or a periodised budget, which is a larger change than this.
