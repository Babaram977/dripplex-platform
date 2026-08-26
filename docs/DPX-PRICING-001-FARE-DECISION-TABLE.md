# DPX-PRICING-001 — Ride Fare Structure & Commission Policy

**Status:** 🟡 **OPEN — awaiting production capture, then founder decisions.**
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

Verified against the implementation, so the decisions above are made against real behaviour:

1. **Metered fare** = base fare + (distance × per-km rate) + (time × per-minute rate), from the
   `ride_fare_rates` row for the requested ride type.
2. **Surcharge**, if either end of the trip falls inside a configured zone — a flat amount or a
   multiplier, per zone, triggered on pickup, dropoff or either end.
3. **Minimum fare floor** applied _after_ base + distance + time. A trip pricing below the floor
   is charged the floor; longer trips are unaffected.
4. **Commission** at the active rate, computed on the resulting total fare, and **snapshotted onto
   the ride** so a later rate change never rewrites a settled trip.
5. **Driver earning** = total fare − platform commission.

The fare shown before booking is an estimate; the charged fare reflects actual distance and time.

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

## 6. Sequence

1. ⬜ **Capture** the four live rate cards and the zone list (§2). Nothing else proceeds until this
   is filled in from the console.
2. ⬜ **Decide** items 1-7 (§3).
3. ⬜ **Apply** the approved values in Operations Console → Pricing & Fares. Console entry, not a
   deploy. Every edit is audit-logged.
4. ⬜ **Verify** the charged fare matches the approved table — a real fare estimate per ride type,
   checked against the arithmetic in §4, including the minimum-fare floor on a sub-kilometre trip.
5. ⬜ **Feed** the approved table into `DPX-LEGAL-001` §7.1 and close the fare blocker in §22
   (PR #287).

Steps 1 and 2 are founder actions. Step 4 is the one that needs engineering, and it is
verification, not implementation.

## 7. What this document does not do

- It does not change any rate. No code in this branch touches pricing.
- It does not decide the Terms language — that is `DPX-LEGAL-001`, and it consumes the outcome
  here.
- It does not reopen the tip or refund rules locked in `docs/DPX-D4-RIDE-REFUND-POLICY.md`.
- It does not set merchant or delivery pricing. Delivery has its own fee basis (minimum ₦500,
  ₦150/km — `apps/backend/src/delivery/delivery.constants.ts:78-79`) and merchant prices are set
  by merchants. Both are out of scope unless the founder widens it.
