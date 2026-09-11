# DPX-TIER-002 — a tier is a reduction, and it now moves money

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. The decision

DPX-TIER-001 shipped the tier engine but deliberately did **not** let it set the commission rate,
and reported a conflict instead: the specification gave each tier an absolute rate, while
`PlatformCommissionSetting` was already an Ops control over that same number. Letting the tier table
set the rate would have made the platform control silently dead for rides.

**Founder decision, 2026-09-11: Option B.** A tier is a **reduction** off the rate in force.

```
effective rate  =  max(0,  rate in force  −  the driver's earned reduction)
```

At today's 10% platform rate the seeded reductions reproduce the specified table exactly:

| Tier     | Reduction | Effective at 10% | Effective at 20% |
| -------- | --------- | ---------------- | ---------------- |
| _none_   | —         | 10%              | 20%              |
| STANDARD | 0         | 10%              | 20%              |
| SILVER   | 0.5 pt    | 9.5%             | 19.5%            |
| GOLD     | 1.0 pt    | 9%               | 19%              |
| PLATINUM | 1.5 pt    | 8.5%             | 18.5%            |

The third column is the point of Option B. Under absolute rates it would have read 10 / 9.5 / 9 /
8.5 no matter what Operations did, and the platform control would have been a knob connected to
nothing.

## 2. What shipped

**`DriverTierSetting.commission_rate` became `commission_reduction`**, renamed rather than added
beside, because a `commission_rate` on that table would be a lie the moment the platform rate moved.
Nothing historical is lost: every ride snapshots the rate it actually settled at, and its tier, onto
the ride row.

**The order of composition is deliberate.** The platform rate — or a commission campaign overriding
it for a window — is resolved first, and the driver's earned reduction comes off that. So a driver
who has earned a point and a half off keeps it during a promotional week as well as an ordinary one,
which is what having earned it means.

**Floored at zero.** A reduction larger than the rate in force would otherwise mean DrippleX paying
the driver for the privilege of dispatching the trip.

**A driver with no tier pays the rate in force**, exactly as every driver did before tiers existed.
Since STANDARD asks for 500 completed trips, that is almost every driver today — so this change moves
no money for them at all.

## 3. A pre-existing bug this uncovered

A commission of exactly **zero** could not settle a cash ride. `CommissionAccountService.accrue`
refuses a zero amount by design (`Amount must be greater than zero`), and `confirmCash` accrued
unconditionally, so settlement threw and the ride could not complete.

That was reachable **before this change and independently of tiers**: DPX-COMMISSION-001 explicitly
allows a campaign at exactly 0% — _"a free week is a real offer and must not be mistaken for
unset"_ — and any such RIDE campaign would have hit it.

Fixed by skipping the accrual when there is nothing to accrue: a zero commission is a real outcome,
not a missing one, and the driver owes nothing for that trip. Both routes to it now have a test, and
removing the guard turns both red.

## 4. Verification

- 5 unit tests on the composition arithmetic: the specified table reproduced at 10%, the platform
  control still moving the result at 20% and 5%, composition with a campaign rate, no tier meaning
  no reduction, and the zero floor.
- 4 database tests at real settlement: a tiered driver charged 8.5% and the rate snapshotted onto
  the ride, the same driver following the platform rate to 18.5% when Operations moves it, an
  untiered driver paying exactly what they paid before, and a reduction exceeding the rate settling
  at zero rather than negative.
- 1 database test for the pre-existing bug: a cash ride settling under a 0% campaign.
- Full suite green against a database created from scratch and migrated only, never seeded.

## 5. Still open

- **No Ops console screen** for the tier table. The admin API takes reductions; there is no page.
  Percent-versus-fraction is exactly the kind of thing a screen should handle at one boundary, as
  the commission campaign page already does.
- **Only rides.** Delivery and marketplace commission have no tier equivalent; nothing in the
  founder decisions asks for one yet.
