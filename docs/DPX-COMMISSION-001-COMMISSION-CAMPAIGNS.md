# DPX-COMMISSION-001 — commission is a campaign, not a constant

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. Founder decision

> "Commission numbers should be controlled from the Ops console, it should be flexible — as in from
> Ops we can decide to bring in a new commission formula based on certain campaigns, like weekend
> orders. Whatever commission we agreed now we can change it later, it should be adjustable in the
> Ops console. For example this week DX will decide to run a 7% commission and then next week decide
> to make it 14%. Let it be flexible. And also users will get notification that a particular
> campaign is going on."

---

## 2. What commission was before this

Two singleton rows, each holding one number:

| Row                                            | Read at                                                                               | Default |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `merchant_commission_settings.commission_rate` | `MerchantSettlementService.settleOrder`                                               | 10%     |
| `platform_commission_settings.commission_rate` | `RiderSettlementService.settleDelivery`, `RidePaymentService.effectiveCommissionRate` | 10%     |

Both were already Ops-editable without a redeploy, and every settled row already snapshotted the
rate it settled at — so history was safe. What they could not express was a rate that ends.

Running "7% this week" against a singleton means an operator edits it on Monday and has to remember
to edit it back on Friday. Editing it back is the part that does not happen. The failure mode is not
a wrong number on one order; it is charging every merchant, rider or driver on the platform a
promotional rate indefinitely, discovered whenever someone next looks.

## 3. What this ships

**`CommissionCampaign`** — a rate, a scope, a window, and optionally conditions. The singletons keep
their meaning as the _standing_ rate: what DrippleX charges when nothing is running. A campaign is a
temporary override on top, and it reverts by itself.

**Three scopes**, one per place the platform actually reads a rate at settlement time:

| Scope            | Who is charged | Where it applies             |
| ---------------- | -------------- | ---------------------------- |
| `MERCHANT_ORDER` | Merchants      | Marketplace order settlement |
| `DELIVERY`       | Riders         | Delivery-fee split           |
| `RIDE`           | Drivers        | Ride-fare split              |

**Conditions reuse the promotions vocabulary** rather than inventing a second eligibility language
for the same ideas. "Weekend orders" is `{ "weekdays": [0, 6] }`. Cities, states, merchant
categories, ride types, payment methods, hour windows and named-partner lists all come for free
because the promotions engine already evaluates them.

**Overlap is deterministic.** Highest `priority` wins, then most recently created. Two equally
plausible campaigns never resolve arbitrarily.

**Announcements.** When a campaign starts, everyone it charges is notified; when it ends, they are
told the rate has reverted. Its own notification types (`COMMISSION_CAMPAIGN_STARTED` /
`_ENDED`) rather than `PROMOTION` or `GENERIC`, because notification preferences are keyed on
`(channel, type)` and what DrippleX charges a partner is not marketing they should be able to mute
alongside offers. A campaign is announced exactly once, however many times the sweep runs, and a
failed announcement never rolls back a rate change that is already in force — the campaign is the
money, the notice is not.

**Provenance.** `order_settlements`, `rides` and `delivery_jobs` each gained a nullable
`commission_campaign_id`. With rates changing week to week, "why was this one 7%?" has to be
answerable from the money record rather than reconstructed from timestamps. Null keeps its existing
meaning — the standing rate applied — so every row that existed before this is correctly null.

**Ops console.** `/commission` — schedule a campaign, see what is running, pause, resume, archive.
Stated in percent throughout, because that is how the decision is made; the API takes a fraction and
the conversion happens at that one boundary.

### Design decisions worth knowing

- **Rules fail closed.** A campaign that constrains something the settlement cannot answer does not
  apply, and the standing rate is charged. That is the only defensible default for money: the
  standing rate is the one both sides already agreed to, so falling back to it is never a surprise
  in either direction.
- **A stored rate outside `[0, 1)` is refused at resolve time**, logged, and the standing rate used.
  A rate of 1 or more takes everything the partner earned, or more. A campaign at exactly 0% is
  allowed — a free week is a real offer and must not be mistaken for "unset".
- **Correctness does not depend on the sweep.** The resolver filters on the window itself, so a
  campaign whose window has closed stops applying whether or not the sweep has marked it `EXPIRED`.
  The sweep (every five minutes) owns the announcement and the status Ops sees.
- **A campaign created inside its own window still starts `SCHEDULED`** and is activated by the
  sweep, so there is one activation path and it always announces.
- **A campaign resumed after its window closed does not come back into force** — resume returns it
  to `SCHEDULED` and the sweep expires it.
- **Finished campaigns cannot be edited.** Editing one would rewrite the explanation for settlements
  that already happened under it. There is no delete either; `archive` is the end of the line.
- **Fleet trips are untouched by `RIDE` campaigns.** A fleet driver's commission is zero because
  DrippleX bills the fleet instead; overriding that would take twice from one fare.

### Verification

- 256 suites / 2530 tests green against **real Postgres and Redis**.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity green.
- 15 resolver unit tests (priority, fall-through, fail-closed, out-of-range refusal, weekend rules)
  and 8 database tests (activation, scope isolation, window expiry without the sweep, announce-once,
  pause, resume-after-window, edit refusal).

---

## 4. Open — needs founder input

### 4.1 Fleet commission

Deliberately not a scope. Fleet commission is **banded on a fleet's monthly order volume** and
settles once the month closes (`FleetCommissionTier`, `FleetCommissionService.rateForFleet`), with a
per-fleet negotiated rate able to beat the band table. A week-long campaign has no well-defined
meaning against a rate that is only knowable when the month ends.

Needed: what a mid-month campaign should do to a whole-month banded rate — override the band for the
whole month, apply pro-rata to the days it covered, or not apply to fleets at all.

### 4.2 Loyalty-tier commission reductions

Still open from `docs/DPX-LOYALTY-001-DX-POINTS.md` §4.1 and **not** solved by this. A campaign is
time-scoped and applies to everyone it covers; a loyalty benefit is per-partner and depends on their
tier. The campaign engine could carry it — `whitelistUserIds` already exists — but driving that from
tiers needs the reduction schedule, and partners accrue no points at all today.
