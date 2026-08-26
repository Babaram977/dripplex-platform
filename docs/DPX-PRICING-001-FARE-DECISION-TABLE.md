# DPX-PRICING-001 — Ride Fare Structure & Commission Policy

**Status:** 🟡 **OPEN — proposed rates recorded (§3A); awaiting production capture (§2) and
resolution of the questions in §4A before any rate is changed.**
**Opened:** 2026-08-26
**Scope (founder-locked, 2026-08-26):** establish and approve the **existing four rate cards** plus
commission and surcharge policy. **Nothing new is built in this pass.**
**Feeds:** `docs/legal/DPX-LEGAL-001-TERMS-OF-USE.md` §7.1 and §22 (PR #287). Pricing keeps its own
audit trail; the Terms document consumes the approved outcome and does not decide it.

---

## 0. Why this exists

DrippleX is charging passengers. The rate cards it charges from were seeded on 2026-08-18 from
constants that carried a warning, in their own source, that they were _"placeholder fare
constants … not a founder-approved fare table"_ — anchored to delivery's per-km pricing rather
than to ride economics.

The ₦1,500 minimum fare underneath them **is** founder-approved (2026-08-16). The base, per-km
and per-minute rates above it are not.

This document takes those rates from "inherited" to "decided". It is not a redesign of the
pricing engine — see §5 for what is deliberately excluded.

## 1. Correcting the record: fares are not hardcoded

An earlier reading of this held that the placeholder constants were compiled into production and
that changing them needed a deploy. **That is wrong, and the difference changes who can fix it.**

Since migration `20260818050000_ride_pricing_console` (2026-08-18):

- Rates live in the **`ride_fare_rates` table**, one row per ride type.
- `RidePricingService.getRate()` (`apps/backend/src/rides/ride-pricing.service.ts:64`) reads the
  **database row**. `RIDE_FARE_RATES` only seeds a row that does not yet exist — the same
  seed-once pattern as `PlatformCommissionSettingsService`.
- The **Operations Console → Pricing & Fares** page edits them live
  (`apps/super-app/src/app/adminConsoleScreen.tsx:5318`, editor at `:6560-6874`), audit-logged
  with before and after, because a fare change is a commercial act.
- Editing a rate **never re-prices a trip that already happened** — each ride snapshots the
  amounts and the commission rate it was priced at.

**So a fare correction is a console entry, not an engineering change.** Once the values in §3 are
decided, an administrator enters them. No deploy, no migration, no code review.

## 2. Capture the live rate cards — DO THIS FIRST

**The seeded values are not authoritative.** An operator may have edited any card since
2026-08-18, and the migration used `ON CONFLICT DO NOTHING`, so it would not have overwritten a
pre-existing row either.

These values could not be read automatically: this session's Railway connection is an OAuth app,
which receives variable **names only** with values redacted, so the production database is not
reachable from here. No console credentials are held either. **The capture below must be filled
in by an administrator reading Operations Console → Pricing & Fares.**

For reference, the values the 2026-08-18 migration inserted:

```sql
INSERT INTO "ride_fare_rates" ("ride_type", "base_fare", "per_km_rate", "per_minute_rate", "minimum_fare")
VALUES
  ('ECONOMY',  300, 120, 20, 1500),
  ('COMFORT',  450, 160, 25, 1500),
  ('XL',       600, 200, 30, 1500),
  ('TRICYCLE', 150,  80, 10, 1500)
ON CONFLICT ("ride_type") DO NOTHING;
```

### 2.1 Live capture — to be completed

| Card           | Ride type  | Base fare | Per-km | Per-minute | Minimum fare | Last edited by / when |
| -------------- | ---------- | --------- | ------ | ---------- | ------------ | --------------------- |
| **Dx Ride**    | `ECONOMY`  |           |        |            |              |                       |
| **Dx Comfort** | `COMFORT`  |           |        |            |              |                       |
| **Dx XL**      | `XL`       |           |        |            |              |                       |
| **Tricycle**   | `TRICYCLE` |           |        |            |              |                       |

The console shows `updatedBy` and `updatedAt` per row. **If any card differs from the seed above,
say so explicitly** — it means a pricing decision was already taken outside this document and
needs to be captured before it is overwritten.

### 2.2 Live surcharge zones — to be completed

| Zone name | Type (FLAT / MULTIPLIER) | Amount or multiplier | Trigger (PICKUP / DROPOFF / EITHER) | Radius | Active? |
| --------- | ------------------------ | -------------------- | ----------------------------------- | ------ | ------- |
|           |                          |                      |                                     |        |         |

If the zone list is empty, record that — "no zones configured" is itself a finding, and it means
no surcharge is being charged today.

## 3. Decisions required

Numbered as the founder listed them, 2026-08-26. Items 8-10 are answered in §5 and need no
further decision in this pass.

| #   | Decision                          | Current position                                                                   | Approved value             |
| --- | --------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| 1   | **Minimum fare**                  | ₦1,500, all four types. Founder-locked 2026-08-16                                  | ⬜ confirm ₦1,500 stands   |
| 2   | **Base fare**                     | Placeholder, per card — see §2.1                                                   | ⬜ per card                |
| 3   | **Per-km rate**                   | Placeholder, per card — see §2.1                                                   | ⬜ per card                |
| 4   | **Per-minute rate**               | Placeholder, per card — see §2.1                                                   | ⬜ per card                |
| 5   | **Platform commission**           | 10%, Ops-configurable, snapshotted per ride                                        | ⬜ confirm 10%             |
| 6   | **Commission on zone surcharges** | **Yes** — commission is computed on `ride.totalFare`, which includes any surcharge | ⬜ confirm or change       |
| 7   | **Zone surcharge configuration**  | Per-zone flat or multiplier; no global surge                                       | ⬜ per zone, after §2.2    |
| 8   | Waiting fees                      | Not implemented                                                                    | ➖ excluded this pass (§5) |
| 9   | Cancellation fees                 | Not implemented                                                                    | ➖ excluded this pass (§5) |
| 10  | Time/condition-based surge        | Not implemented                                                                    | ➖ excluded this pass (§5) |

## 3A. PROPOSED — PENDING FOUNDER APPROVAL / PRODUCTION COMPARISON

> ⚠️ **These are proposed target rates, not evidence of what is live.** They must be compared
> against the §2.1 production capture before anything is changed. Nothing here has been entered
> into the Operations Console.

Founder pricing proposal, 2026-08-26. Stated objective: **penetration-priced but still
driver-viable** for the first Kano launch — competitive with the market rather than a copy of it.

### 3A.1 Proposed rate cards

| Rate card      | Base | Per-km | Per-min | Minimum |
| -------------- | ---- | ------ | ------- | ------- |
| **Dx Ride**    | ₦350 | ₦110   | ₦15     | ₦1,500  |
| **Dx Comfort** | ₦450 | ₦135   | ₦18     | ₦1,500  |
| **Dx XL**      | ₦600 | ₦165   | ₦22     | ₦1,700  |
| **Tricycle**   | ₦150 | ₦75    | ₦8      | ₦800    |

Founder rationale, recorded as given:

- **Dx Ride** is the mass-market product — room to compete while still producing meaningful driver
  earnings.
- **Dx Comfort** takes a moderate premium rather than becoming an expensive luxury tier.
- **Dx XL** carries a meaningful premium for vehicle operating cost and capacity, including a
  higher ₦1,700 floor.
- **Tricycle** is a different market. A ₦1,500 floor would leave the product economically
  disconnected from Kano's short-distance keke trade, where published estimates put short journeys
  around ₦300-₦1,000.

Benchmarks cited (public route examples, **not authoritative rate cards**): Bolt operating in
Kano at roughly ₦1,900 for a ~4.5 km route; other published Kano estimates putting short app rides
at ₦1,500-₦4,500; Bolt publishing fixed Kano airport route charges of ₦3,500-₦3,600.

### 3A.2 This changes a previously locked decision

The 2026-08-16 founder decision set the minimum trip charge at **₦1,500 for every ride type**. The
proposal **varies the floor by vehicle class** — ₦1,700 on Dx XL, ₦800 on Tricycle.

Recorded explicitly as a change to a locked decision rather than folded in silently. The schema
supports it without a migration: `ride_fare_rates.minimum_fare` is a per-type column.

### 3A.3 Commission

- **10% launch commission — retained.** Aggressive for DrippleX, attractive to drivers, which is
  the right trade during market entry.
- **Commission continues to apply to the ride total including any approved zone surcharge**
  (decision 6 confirmed as-is).
- **New requirement: this must be explicitly disclosed to drivers**, not left as an invisible
  deduction. That is a product change — a visible line on the driver's earnings breakdown — and
  it is **not built today**. Tracked in §6 as a follow-up, not implemented in this pass.

### 3A.4 Surcharges

- Keep zone-based surcharge capability; configure **only specific, justified zones**.
- **No global surge multiplier.**
- An airport surcharge is appropriate and commercially normal.
- **No rain or peak-hour dynamic pricing at launch.**

The launch pricing model stays legible: **base + distance + time, subject to a minimum, plus a
clearly disclosed zone surcharge.**

### 3.1 Decision 6 deserves its own look

Driver earnings are `total fare − platform commission`, computed on `ride.totalFare`
(`apps/backend/src/rides/ride-payment.service.ts:552-555`). `totalFare` **includes the zone
surcharge**.

So on an airport run carrying a ₦2,000 flat surcharge, DrippleX takes 10% of that ₦2,000 as well
as 10% of the metered fare. That may be exactly right — the surcharge is platform-set, not
driver-set. It may also be wrong, if the surcharge is meant to compensate the driver for a
dead-leg return. **It is currently inherited rather than chosen**, which is the only reason it is
on this list.

Tips are excluded from commission entirely and are never clawed back on a refund — that behaviour
is founder-locked in `docs/DPX-D4-RIDE-REFUND-POLICY.md` and is not reopened here.

### 3.2 Minimum fare can vary by type

`ride_fare_rates.minimum_fare` is a **per-type column**, not a global. All four cards are seeded
at ₦1,500, but a different floor per vehicle class is possible without a migration. Worth a
deliberate answer: a ₦1,500 floor on a Tricycle whose base fare is ₦150 is a very different
commercial statement from the same floor on a Dx XL.

## 4. How a fare is computed today

Verified line by line against `apps/backend/src/rides/ride-fare.service.ts:49-88`, because the
proposed rates in §3A can only be judged against the real arithmetic:

1. **Distance** = `haversineMeters(pickup, dropoff)` — **straight-line, not road distance.**
2. **Duration** = distance ÷ `DEFAULT_RIDE_SPEED_MPS` (8.33 m/s ≈ **30 km/h**) — a constant, **not
   measured traffic**. So time is a fixed function of distance: **2 minutes per km**.
3. **Metered fare** = base + round(km × per-km) + round(minutes × per-minute).
4. **Surcharge**, if a zone applies, added to the metered fare. Zones do **not** stack — the
   single largest applies. (That non-stacking rule is flagged in the source as an engineering
   choice awaiting founder confirmation, not a founder decision.)
5. **Minimum fare floor** applied **last**, to metered + surcharge: `max(beforeFloor, minimumFare)`.
6. **Commission** at the active rate on the resulting total, snapshotted onto the ride.
7. **Driver earning** = total fare − platform commission.

Two consequences that matter for §3A and are easy to miss:

- Because duration is derived from distance at a fixed 30 km/h, **the per-minute rate is not an
  independent lever.** It behaves as an addition to the per-km rate: every ₦1 of per-minute rate
  is worth ₦2 per km. The effective distance rate is `perKm + 2 × perMinute`.
- Because distance is straight-line, **the fare under-measures the road actually driven** —
  typically by 20-40% in a street grid. A driver is paid for the crow-flight distance, not the
  route.

## 4A. What the proposed rates actually produce

Applying §4's arithmetic to §3A. Effective rate per km = `perKm + 2 × perMinute`.

| Card       | Base | Effective ₦/km | Minimum | **Minimum binds up to** |
| ---------- | ---- | -------------- | ------- | ----------------------- |
| Dx Ride    | ₦350 | ₦140           | ₦1,500  | **8.2 km**              |
| Dx Comfort | ₦450 | ₦171           | ₦1,500  | **6.1 km**              |
| Dx XL      | ₦600 | ₦209           | ₦1,700  | **5.3 km**              |
| Tricycle   | ₦150 | ₦91            | ₦800    | **7.1 km**              |

"Minimum binds up to" is the straight-line distance at which the metered fare finally reaches the
floor. Below it, **every trip costs exactly the minimum**, regardless of distance. In road terms
those thresholds are roughly 20-40% further again.

### 4A.1 The minimum fare is doing nearly all the work

The ₦1,500 floor was approved on 2026-08-16 with the stated rationale _"that is a distance of less
than a km."_ Under the proposed rates it covers **8.2 km straight-line on Dx Ride** — closer to 10-11 km
of real road. It is not a floor for edge cases; it is the price of most urban trips in Kano.

Worked examples, Dx Ride:

| Trip   | Metered | Charged    | Multiple                   |
| ------ | ------- | ---------- | -------------------------- |
| 1 km   | ₦490    | **₦1,500** | 3.1×                       |
| 2 km   | ₦630    | **₦1,500** | 2.4×                       |
| 4.5 km | ₦980    | **₦1,500** | 1.5×                       |
| 8.2 km | ₦1,498  | ₦1,500     | 1.0× — floor stops binding |
| 12 km  | ₦2,030  | ₦2,030     | metered                    |

Against the ₦1,900 / 4.5 km Bolt benchmark, DrippleX at ₦1,500 is genuinely competitive. **The
penetration pricing works — but it is the minimum delivering it, not the rate card.** The base,
per-km and per-minute values are inert below 8.2 km.

### 4A.2 Tricycle: ₦800 is a large improvement and still likely above the market

Raising the Tricycle floor from ₦1,500 to ₦800 is directionally right and materially better. But
against the ₦300-₦1,000 range cited for short Kano keke journeys:

| Trip   | Metered | Charged  | Multiple |
| ------ | ------- | -------- | -------- |
| 1 km   | ₦241    | **₦800** | 3.3×     |
| 2 km   | ₦332    | **₦800** | 2.4×     |
| 3 km   | ₦423    | **₦800** | 1.9×     |
| 7.1 km | ₦796    | ₦800     | 1.0×     |

A 1-2 km keke trip — the archetypal Kano keke journey — is charged **₦800 against a street rate
nearer ₦300**. The product remains priced for trips the keke market does not mostly make. Worth a
second look at whether the Tricycle floor should be lower still (₦400-₦500), or whether Tricycle
should carry no floor at all and rely on its ₦150 base.

**Flagged for decision, not changed.** The approved figure in §3A stands at ₦800 until the founder
says otherwise.

### 4A.3 The floor distorts both sides of the market

Below the binding distance, fare is flat and so is driver earning. A driver nets ₦1,350 (after 10%)
for a 1 km trip and the same ₦1,350 for an 8 km trip that takes eight times as long.

- **Drivers** are rewarded for short trips and penalised for medium ones. Expect long-trip
  rejection once drivers notice.
- **Passengers** taking short trips subsidise those taking medium ones.

This is inherent to a high floor over low rates, not a defect in the code. It is manageable at
launch and worth watching in the first weeks' data — trip-length distribution against acceptance
rate will show it quickly.

### 4A.4 A surcharge below the floor earns nothing

Because the floor is applied **after** the surcharge, a zone surcharge on a trip whose metered
fare is under the minimum is partly or wholly absorbed. Tricycle metered ₦241 + a ₦500 surcharge =
₦741, still below the ₦800 floor, so the passenger pays ₦800 and the surcharge yields nothing.

For the airport case this mostly does not bite — an airport run is long enough to clear the floor
(Dx Ride at 15 km meters at ₦2,450, and a ₦1,000 surcharge takes it to ₦3,450, against the
₦3,500-₦3,600 Bolt publishes for Kano airport routes). Worth knowing before any short-distance
zone is configured.

### 4A.5 Straight-line distance is a driver-viability question

Fares are computed on crow-flight distance. On a real street grid the driven distance is
commonly 20-40% greater. The driver covers that fuel and time unpaid.

This is not introduced by the proposed rates — it is existing behaviour — but it bears directly on
"driver-viable", and it means the effective per-km yield is lower than the rate card suggests.
Recorded here as a known limitation; changing it means road-distance routing, which is an
engineering change and out of scope for this pass.

## 5. Deliberately excluded from this pass

Founder decision, 2026-08-26: **do not add waiting fees, cancellation fees, or dynamic surge
during this pricing pass.** For the first controlled DrippleX launch the pricing engine stays
simple and auditable.

Recorded so the absence is understood as a decision rather than an oversight:

| Feature                       | State                          | Note                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Waiting time charge**       | **Not implemented**            | No constant, no field, no code path. The `waitingTime` field at `apps/backend/src/rides/dto/ride-rating.dto.ts:43` is a passenger **rating** dimension, not money.                                                                       |
| **Cancellation fee**          | **Not implemented**            | No fee anywhere in the platform. A ride cancelled before it starts moves no money — settlement runs only on completion.                                                                                                                  |
| **Global / time-based surge** | **Not implemented, by design** | There is no global surge multiplier: no field on the rate, no endpoint. Premium pricing is per-zone only. A previous console toggle multiplied a local preview and displayed a price the Ride module would never charge; it was removed. |

Each of these is an engineering change, not a rate-card edit. If any is wanted later it gets its
own design and its own document — not an amendment here.

### 5.1 Launch exclusions, as decided

Founder decision, 2026-08-26 — the full list, so nothing is ambiguous later:

| Feature          | Launch decision |
| ---------------- | --------------- |
| Waiting fee      | **No**          |
| Cancellation fee | **No**          |
| Global surge     | **No**          |
| Time-based surge | **No**          |
| Rain multiplier  | **No**          |
| Booking fee      | **No**          |

None of the six exists in the platform today, so "no" requires nothing to be removed.

## 6. Sequence

1. ⬜ **Capture** the four live rate cards and the zone list (§2). Nothing else proceeds until this
   is filled in from the console.
2. ✅ **Propose** the target rates and commission/surcharge policy — §3A, founder proposal
   2026-08-26.
3. ⬜ **Compare** §3A against the §2.1 capture. If a live card already differs from the seed,
   that difference is a decision someone took and must be understood before it is overwritten.
4. ⬜ **Resolve** the open questions §4A raises — the Tricycle floor (§4A.2) above all.
5. ⬜ **Approve** the final table, at which point §3A stops being a proposal.
6. ⬜ **Apply** in Operations Console → Pricing & Fares. Console entry, not a deploy. Every edit
   audit-logged.
7. ⬜ **Verify** the charged fare matches the approved table — a real estimate per ride type
   against the arithmetic in §4, including a sub-kilometre trip and one trip either side of each
   card's binding distance.
8. ⬜ **Feed** the approved table into `DPX-LEGAL-001` §7.1 and close the fare blocker in §22
   (PR #287).

Steps 1, 3, 4 and 5 are founder actions. Step 7 is the only one needing engineering, and it is
verification, not implementation.

### 6.1 Follow-up raised by this pass, not part of it

**Driver-facing commission disclosure** (§3A.3). The founder's requirement that the 10% commission
— including its application to zone surcharges — be explicitly disclosed to drivers rather than
deducted invisibly is **not satisfied by anything currently built**. It needs a visible line on
the driver earnings breakdown.

That is a product change, not a rate-card edit, and it is deliberately not bundled here. It should
get its own change once the tracker question is settled.

## 7. What this document does not do

- It does not change any rate. No code in this branch touches pricing.
- It does not decide the Terms language — that is `DPX-LEGAL-001`, and it consumes the outcome
  here.
- It does not reopen the tip or refund rules locked in `docs/DPX-D4-RIDE-REFUND-POLICY.md`.
- It does not set merchant or delivery pricing. Delivery has its own fee basis (minimum ₦500,
  ₦150/km — `apps/backend/src/delivery/delivery.constants.ts:78-79`) and merchant prices are set
  by merchants. Both are out of scope unless the founder widens it.
