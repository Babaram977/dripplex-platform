# DPX-PRICING-002 — Charge the time a trip actually took

**Status:** 🟢 **Built.** Founder decision taken 2026-08-27; implemented in the same pass.
**Opened:** 2026-08-27
**Scope:** the ride fare's **time component only**. Rate values, the minimum-fare floor, surcharge
policy and commission are untouched — those are DPX-PRICING-001 and remain open there.
**Depends on:** `docs/DPX-PRICING-001-FARE-DECISION-TABLE.md` §4 (the arithmetic this changes one
step of).

---

## 1. The complaint

> "No traffic trips are getting more charges base on time driver get stucked, that is where timing
> works." — founder, 2026-08-27

## 2. What the code did, verified

`RideFareService.estimate()` derived duration from distance:

```
durationSeconds = distanceMeters ÷ DEFAULT_RIDE_SPEED_MPS   // 8.33 m/s ≈ 30 km/h
```

That number was computed once, **at request time**, and the fare it produced was written onto the
ride and never revisited. `RideTripService.completeTrip()` set `status` and `completedAt` and
touched no money at all.

So the per-minute rate was not a time rate. At a fixed 8.33 m/s, ₦20/min is arithmetically
**₦40/km** — every trip, exactly. DPX-PRICING-001 §4 records the same finding from the other
direction: _"the per-minute rate is not an independent lever… the effective distance rate is
`perKm + 2 × perMinute`."_

The practical consequence is the founder's: two drivers covering the same two points, one on an
open road and one held for half an hour in Kano traffic, were paid the same naira. The platform
had a time rate on the books and charged nobody for time.

## 3. Decision

**Founder, 2026-08-27 ("go with your recommendation"):**

1. **The time component is charged on real elapsed time** — `completedAt − startedAt` — computed at
   completion, replacing the estimate.
2. **The meter starts at `startedAt`**, when the driver taps Start with the passenger aboard. Time
   waiting at the kerb stays unpaid; waiting fees were excluded from this launch.
3. **No cap.** A short trip in gridlock can cost more than a long one on an open road. That is the
   honest consequence of charging for time; a cap is a pricing decision to take on real Kano data,
   not to guess now.
4. **The booking quote stays a quote.** It is preserved on the ride and shown on the receipt beside
   the final charge, so a passenger can see why the two differ.

## 4. What was built

| Change                                        | Where                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `price(rideType, pickup, dropoff, duration)`  | `ride-fare.service.ts` — split out of `estimate()`, which now delegates to it |
| Reprice at completion                         | `ride-trip.service.ts` `completeTrip()` → `repriceOnActualDuration()`         |
| `rides.actual_duration_seconds`               | migration `20260827090000_ride_actual_duration_pricing`                       |
| `rides.quoted_total_fare`                     | same migration                                                                |
| Both fields on `RideDto`                      | `packages/types/src/ride/index.ts`, `ride.mapper.ts`                          |
| Receipt reports the real duration + the quote | `ride-receipt.service.ts`, `RideReceiptDto`                                   |
| Receipt UI line                               | `apps/super-app/src/app/rideScreen.tsx`, `customer-web` trip-receipt-screen   |

**`estimate()` is unchanged in behaviour.** A booking quote still assumes 30 km/h, because before a
trip there is no elapsed time to charge. The two paths now share one implementation, which the
fare spec pins: pricing the estimate's own duration returns the estimate exactly.

### 4.1 Why repricing at completion is safe

`RidePaymentService` refuses both the gateway and the cash path unless the ride is already
`COMPLETED`. Nobody has paid the quote by the time the reprice runs, so there is no second charge
and no refund to reconcile. **If that gate ever moves, this becomes a double-charge and the two
must change together** — the constraint is written into the helper's doc comment for whoever moves
it.

### 4.2 Deliberately not done

- **The promo discount is not rescaled.** It was granted against the quote and already accepted by
  the customer; re-deriving it would reopen redemption accounting mid-completion. It is subtracted
  from the recomputed total, and the total floors at zero.
- **Driver earning and commission are not recomputed here.** They are set by the payment path,
  which runs after completion and therefore already reads the repriced total.

## 5. What this changes commercially

Effective ₦/km is no longer `perKm + 2 × perMinute`. The per-km and per-minute rates are now
independent levers, which is what DPX-PRICING-001 §3A's proposed cards were implicitly assuming
and could not previously deliver.

**The quoted fare is unchanged** — the booking screen still prices at 30 km/h — so every "minimum
binds up to" figure in DPX-PRICING-001 §4A still describes what a passenger is quoted. What
changes is the **final** charge:

| Dx Ride, 10 km straight-line | Time   | Time fare | Total  |
| ---------------------------- | ------ | --------- | ------ |
| Quote (assumed 30 km/h)      | 20 min | ₦400      | ₦1,900 |
| Actual, clear road           | 14 min | ₦280      | ₦1,780 |
| Actual, heavy traffic        | 45 min | ₦900      | ₦2,400 |

Seeded ECONOMY card: base ₦300 + ₦120/km + ₦20/min, so ₦300 + ₦1,200 + time. All three clear the
₦1,500 floor, which is why time moves the total at all — see §5.1.

### 5.1 Known limit — the floor still swallows short trips

The minimum is applied **after** time, so a trip whose metered fare sits below the floor is charged
the floor no matter how long it took. On the seeded ECONOMY card a 2 km trip meters at
₦300 + ₦240 + ₦20/min, so it must sit in traffic for **48 minutes** before the meter even reaches
₦1,500 — up to that point, charging for time changes the passenger's total by nothing.

This is not a defect in the repricing — it is DPX-PRICING-001 §4A.1's finding ("the minimum fare is
doing nearly all the work") showing up again. Charging real time only changes a total that already
clears the floor: on the seeded card, roughly **7.5 km straight-line** at the quoted 30 km/h, and
proportionately less distance the slower the trip actually is. It is asserted as a property in
`ride-trip.service.spec.ts` so it cannot become a surprise.

**Founder follow-up:** if drivers stuck in short urban trips are the population being under-paid,
the lever is the floor and the rate card (DPX-PRICING-001 §3A/§4A), not this change.

### 5.2 Known gap — an Ops rate edit mid-trip applies to that trip

The whole fare is recomputed from the rates **live at completion**, so a rate changed while a trip
is running prices that trip. The window is the length of one ride. Closing it means snapshotting
the four rate values onto every ride row at booking, which is a schema decision needing founder
sign-off — recorded here rather than invented.

This also narrows DPX-PRICING-001 §1's statement that _"editing a rate never re-prices a trip that
already happened"_: the snapshot now happens at **completion**, not at booking. A completed trip is
still immutable.

## 6. Verification

- `apps/backend/src/rides/ride-trip.service.spec.ts` — 8 cases against real Postgres: traffic costs
  more, a fast trip costs less, the elapsed seconds are recorded, the quote is preserved, the promo
  discount survives, the total floors at zero, the ₦1,500 minimum still binds, and a ride with no
  `startedAt` completes untouched. Mutation-checked: removing the reprice write fails 7 of them.
- `apps/backend/src/rides/ride-fare.service.spec.ts` — `price()` equals `estimate()` at the assumed
  speed; time scales with duration; zero duration charges no time; the floor still applies.
- `apps/backend/src/rides/ride-receipt.service.spec.ts` — the receipt reports the real duration,
  shows the quote only when it differs, and falls back to the estimate for pre-existing rides.
- `apps/backend/prisma/schema-migration-parity.spec.ts` — migration matches the schema.
- Full backend suite: **235 suites / 2159 tests green** against real Postgres + Redis.
