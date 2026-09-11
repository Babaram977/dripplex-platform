# DPX-TIER-001 — driver commission tiers

**Status:** Engine shipped and configurable. **Not yet wired into settlement — one conflict needs a
decision (§4).**
**Date:** 2026-09-11

---

## 1. Specification

Nora's revised business rules, 2026-09-11. A driver's tier is earned on **completed trips and a
sustained customer rating together**, never volume alone:

**Founder override, 2026-09-11** — Saeed raised every trip threshold well above Nora's proposed
100/300/600: _"Driver rating goes with number of trips — standard is 500, Silver 1500, Gold 2500,
Platinum 4500 trips."_

| Tier         | Commission    | Completed trips | Rated trips | Average rating |
| ------------ | ------------- | --------------- | ----------- | -------------- |
| _(none yet)_ | platform rate | under 500       | —           | —              |
| STANDARD     | 10%           | 500             | —           | —              |
| SILVER       | 9.5%          | 1,500           | 50          | 4.60           |
| GOLD         | 9%            | 2,500           | 100         | 4.70           |
| PLATINUM     | 8.5%          | 4,500           | 200         | 4.80           |

That changes what STANDARD _is_. It is no longer the tier a driver starts on but one they earn at
500 completed trips, so a driver below that **holds no tier at all** and is charged the standing
platform rate — exactly what they were charged before tiers existed. Nobody's commission moves
because of this.

**The rating bars are kept.** Saeed's note that reviews "cannot affect the star rating" protects the
rating's integrity; it does not ask for the bar to be removed as a qualification, and a tier earned
on volume alone is the thing Nora's design set out to prevent. If that reading is wrong it costs no
deployment to fix: setting a rating bar to 0 in the tier table turns it off.

Every one of those numbers is a database row, editable by Operations. Changing what DrippleX charges,
or what it takes to earn a discount, must never require a deployment.

---

## 2. What shipped

**`DriverTierService`** computes a driver's standing from the ledger of what actually happened —
completed rides, customer ratings on those rides, and the driver's own cancellations. A tier is
**never stored on the driver**: a cached tier drifts from the trips and ratings it claims to
summarise, and the rate it sets is money.

Two safeguards are the point of the design:

- **A rated-trip floor separate from the trip count.** Three five-star trips make a 5.00 average and
  prove nothing. Silver wants 50 ratings behind its 4.60, so an average has to be sustained rather
  than lucky. There is a test for exactly this: 120 trips, a flawless 5.00 from three ratings, and
  the driver stays STANDARD.
- **An unrated driver has not met a rating bar.** They have not been measured, which is not the same
  as clearing it — so `averageRating` is `null`, not `0`, and a null never qualifies.

**Cancellation rate is measured against everything the driver was assigned**, not against completed
trips alone. Measuring against completions would mean cancelling more _improves_ the ratio.

**Ops surface**: `GET/PATCH /admin/drivers/tiers`, on the same permission as the standing platform
commission rate — editing a tier changes what a whole class of drivers is charged, which is the same
class of decision. The tier table is seeded by migration rather than in code, so it is the source of
truth from its first row.

**`rides.driver_tier`** now records the tier a driver held when the ride settled, beside the rate
that was already snapshotted. A driver who later drops to STANDARD cannot make a GOLD ride look like
it was ever charged at 10% (§19 of the specification — already satisfied for the rate itself).

### Verification

- 260 suites / 2580 tests green against a fresh, migrate-only, never-seeded Postgres with `CI=true`.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity exact.
- 12 tier tests: promotion refused on trips alone, refused on a handful of perfect ratings, granted
  on both together, held at the tier the rating actually clears, Platinum at the top thresholds,
  cancellation measured against assignments, a cancellation gate enforced once set, next-tier
  progress, a threshold Ops changes taking effect with no deployment, a retired tier skipped, and a
  percentage rejected where a fraction is required.

---

## 3. How this sits with commission campaigns

`CommissionCampaign` (DPX-COMMISSION-001) overrides the **standing** rate for a window. A tier sets
what the standing rate _is_ for a given driver. So the intended order is:

```
fleet trip            → 0% (the fleet is billed instead; no tier, no campaign)
campaign in force     → the campaign's rate
otherwise             → the driver's standing rate
```

That ordering is already implemented. What is not settled is what "the driver's standing rate"
should mean — see below.

---

## 4. ⚠ Conflict — reported, not resolved

**The specification gives each tier an absolute commission rate. DrippleX already has a second
Ops-configurable control over the same number.**

`PlatformCommissionSetting.commissionRate` (DPX-LAUNCH) is the Ops-editable platform commission on
rides, deliberately built so an administrator can change it without a redeploy. Two tests encode
that as a guarantee: _"settlement uses the active configured rate and snapshots it onto the ride"_
and _"refund reverses the historical settled commission, not the current rate"_.

If the tier table sets the rate, that control becomes **silently dead for rides** — an operator
could change the platform rate from 10% to 20% and nothing would move, because STANDARD says 10%.
Two live controls over one figure, one of them quietly ignored, is not something to introduce into
settled money on an assumption.

**So the tier is computed and recorded, but the platform rate still governs.** No money has changed.

### The decision needed

| Option                                                            | Behaviour                                                                                                           | Consequence                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **A — tier rate is absolute** (as literally specified)            | STANDARD 10%, SILVER 9.5%, … regardless of the platform setting                                                     | The platform commission control stops affecting rides. It should then be retired or scoped to something else, not left as a dead knob. |
| **B — tier is a reduction off the platform rate** _(recommended)_ | Reduction per tier: 0 / 0.5 / 1.0 / 1.5 points. At today's 10% platform rate this yields exactly 10 / 9.5 / 9 / 8.5 | Both controls stay live: Ops moves the platform rate and every tier moves with it, keeping the relative reward intact.                 |

**I recommend B.** It reproduces the specified table exactly at the current platform rate, keeps the
existing Ops control meaningful, and expresses what the tiers actually are — a reward for good
drivers relative to the standard rate, rather than four unrelated constants that would each need
editing whenever the platform rate moves.

Say which, and wiring it into settlement is a small change: the engine, the configuration surface,
the snapshot column and the tests are all in place.
