# DPX-OPS-001 Slice 4 — Operations Analytics: Reality Audit

**Status: audit complete, submitted for founder review before implementation
begins.** Per the founder's own instruction on approving the Slice 3 freeze:
"begin with a reality audit before implementation... Don't invent metrics
whose underlying timestamps or events don't exist." Every claim below was
checked directly against `apps/backend/prisma/schema.prisma` and the real
service/controller code — not assumed. Same methodology as
`docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md`.

**Scope**: what real data exists, right now, for the founder's named
analytics areas — fleet availability, driver utilization, shifts, ride
demand/completion/cancellation, dispatch performance, SOS/support/incident
response times, and geographic activity — and what a Slice 4 built strictly
from that real data would look like. This document does not implement
anything.

**Standing constraint, unchanged from every prior slice**: `apps/backend/
src/rides/` is frozen. Analytics reads Ride/RideOffer/DriverShift/
DriverAvailability/OperationsCase directly via Prisma, the same
cross-module-read pattern Slices 1-3 established — it does not import from
`rides/`. And per `docs/DPX-OPS-001-FIGMA-PROTECTION-RULE.md`, Slice 4 must
not touch the appearance of any Figma-derived screen or change a Locked
`packages/ui` component's existing rendering — see §6 below.

## 1. Per-area data audit

Every row checked against the real Prisma schema, not the founder's request
list assumed to already exist.

### 1.1 Fleet availability

| Capability                                      | Status           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current fleet composition (online/offline/busy) | ✅ Real          | `DriverAvailability.online`/`acceptingRides`/`activeRideCount`, `Vehicle.rideCategory` for vehicle-type breakdown — the same fields `OperationsFleetService.getFleetSnapshot()` already reads for Slice 1                                                                                                                                                                                                                                                         |
| Fleet availability **trend over time**          | ❌ Not available | `DriverAvailability` is a **singleton row per driver, overwritten in place** (`@id driverId`, `updatedAt` on write) — there is no history table recording past online/offline transitions. Slice 2's own Live Activity Feed already documented this exact gap when it deliberately excluded driver online/offline events for the same reason. A "% of fleet online by hour over the last 7 days" chart would require inventing data that isn't recorded anywhere. |

**Conclusion**: a real-time fleet-composition snapshot is buildable (and
partly already built in Slice 1). A historical fleet-availability trend is
not, without a new event-logging table this audit is not proposing to add
without separate founder approval.

### 1.2 Driver utilization

| Capability                                               | Status            | Evidence                                                                                                                                                                                              |
| -------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shift duration per driver                                | ✅ Real           | `DriverShift.startedAt`/`endedAt`/`totalBreakSeconds` — already computed for the driver's own view by `DriverShiftService`                                                                            |
| Trips completed per driver, per period                   | ✅ Real           | `Ride.driverId` + `status = 'COMPLETED'` + `completedAt`, groupable by any period bucket                                                                                                              |
| Earnings per driver, per period                          | ✅ Real           | `Ride.driverEarning` (set by `RideSettlementService`, RIDE-002.7) — real, already the system of record for driver payout                                                                              |
| Utilization ratio (active-trip time ÷ online/shift time) | ✅ Real, computed | Both halves are real (`Ride.startedAt`→`completedAt` for on-trip time, `DriverShift` for online time); the ratio itself is a derived calculation over two real timestamp sets, not an invented metric |

**Conclusion**: fully real. Driver utilization is one of the strongest data
sets Slice 4 has to work with.

### 1.3 Shift supervision

| Capability                            | Status  | Evidence                                                                                                                    |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Active/on-break/ended shift counts    | ✅ Real | `DriverShift.status` — already listable via `AdminDriverShiftsController` (Driver Slice 2)                                  |
| Shift length distribution             | ✅ Real | `startedAt`/`endedAt` per shift, aggregable                                                                                 |
| Force-ended shifts (abandoned/stuck)  | ✅ Real | `DriverShift.forceEndedBy`/`adminNotes`                                                                                     |
| Break/fatigue reminder trigger counts | ✅ Real | `breakReminderSentAt`/`fatigueWarningSentAt`/`dailyLimitNotifiedAt` — already computed by `DriverShiftReminderSweepService` |

**Conclusion**: fully real, nothing to invent.

### 1.4 Ride demand / completion / cancellation

| Capability                             | Status                         | Evidence                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ride demand by time/rideType           | ✅ Real                        | `Ride.requestedAt` + `Ride.rideType` (`ECONOMY`/`COMFORT`/`XL`/`TRICYCLE`), indexed on `requestedAt`                                                                                                                                                        |
| Completion rate                        | ✅ Real                        | `Ride.status = 'COMPLETED'` ÷ total requested, over any window                                                                                                                                                                                              |
| Cancellation rate, by who cancelled    | ✅ Real, with an honest caveat | `Ride.cancelledBy` is `CUSTOMER`/`DRIVER`/`SYSTEM` — but the Slice 3 audit already confirmed `SYSTEM` has **zero real call sites platform-wide**. A "cancelled by system" metric would always read zero; that's the honest number, not a gap to paper over. |
| `NO_DRIVERS_FOUND` rate, kept distinct | ✅ Real                        | `Ride.status = 'NO_DRIVERS_FOUND'` is its own enum value, separate from `CANCELLED` — the same distinction Slice 3's ride detail view already surfaces (`noDriversFound`), reused here rather than re-derived differently                                   |
| Cancellation reason breakdown          | ✅ Real                        | `Ride.cancellationReason` (free text) — groupable as raw strings only; there is no structured reason-code taxonomy, so a Slice 4 breakdown would be "top raw reasons," not a clean fixed category chart                                                     |

**Conclusion**: fully real. This is the richest single table for demand/
completion/cancellation analytics — every row is a permanent historical
record, not a point-in-time snapshot.

### 1.5 Dispatch performance

| Capability                                 | Status  | Evidence                                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time-to-accept per offer                   | ✅ Real | `RideOffer.offeredAt` → `respondedAt`, for `status = 'ACCEPTED'` offers                                                                                                                                                                                                                  |
| Offers-per-ride (dispatch attempts needed) | ✅ Real | `count(RideOffer)` grouped by `rideId` — directly comparable against the frozen `MAX_DISPATCH_ATTEMPTS`/`RIDE_OFFER_TIMEOUT_MS` constants (duplicated as plain numbers for context, same pattern as Slice 3's `haversineMeters`/ETA-constant duplication — never imported from `rides/`) |
| Decline/expire rate                        | ✅ Real | `RideOffer.status IN ('DECLINED', 'EXPIRED')` ÷ total offers                                                                                                                                                                                                                             |
| "Rides needing repeated offers" rate       | ✅ Real | Same `RideOffer` grouping as above — this is the exact same underlying data `computeDispatchExceptions()`'s repeated-offer-failure category (Slice 3, operations-console) already reads, just aggregated across rides instead of shown per-ride                                          |

**Conclusion**: fully real, and directly continuous with Slice 3's own
per-ride dispatch data — Slice 4 aggregates what Slice 3 already surfaces
one ride at a time.

### 1.6 SOS / support / incident response times

| Capability                                                    | Status  | Evidence                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time-to-first-response, uniformly across SOS/Incident/Support | ✅ Real | `OperationsCase.createdAt` → `firstRespondedAt` — this field was built in Slice 2 specifically as unified SLA tracking across all three case types (`caseType` discriminator), so this is a **single query pattern**, not three separate ones |
| Time-to-resolution                                            | ✅ Real | `OperationsCase.createdAt` → `resolvedAt`                                                                                                                                                                                                     |
| Time-to-closure                                               | ✅ Real | `OperationsCase.createdAt` → `closedAt`                                                                                                                                                                                                       |
| Volume by case type / priority / status                       | ✅ Real | `OperationsCase.caseType`/`priority`/`status`, groupable directly                                                                                                                                                                             |
| Case timeline detail (what happened, when)                    | ✅ Real | `OperationsCaseEvent` — immutable, append-only, already the audit trail this exact use is for                                                                                                                                                 |

**Conclusion**: fully real, and arguably the single strongest data source in
this whole audit — Slice 2's `OperationsCase` wrapper table was built with
SLA fields as a first-class concern, not bolted on. Response-time analytics
across all three queues is one query shape, not three.

### 1.7 Geographic activity

| Capability                                               | Status                       | Evidence                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ride demand heatmap (pickup/dropoff density, historical) | ✅ Real                      | `Ride.pickupLatitude`/`pickupLongitude`/`dropoffLatitude`/`dropoffLongitude` are permanent columns on every historical ride row — a demand heatmap over any past date range is a real query, not a snapshot limitation                                                                                       |
| Live driver location distribution (current moment only)  | ✅ Real, current-state only  | `DriverAvailability.latitude`/`longitude` — same data Slice 1's Live Fleet Map already renders; usable for a live geographic snapshot, not a historical trend (same singleton-row limitation as §1.1)                                                                                                        |
| Historical driver-position/movement trend                | ❌ Not available             | No driver-location history table exists — `DriverAvailability` overwrites in place, `RideTracking` only exists per-ride while that ride is active and isn't a general fleet-position log                                                                                                                     |
| Named regions/zones                                      | ❌ Deliberately out of scope | Confirmed again: no canonical geography/zone model exists anywhere in the schema. This is the same gap Slice 2's filter work found and the founder explicitly deferred rather than have it invented. Slice 4 follows the same discipline — lat/lng-based heatmaps only, no fabricated zone names/boundaries. |

**Conclusion**: ride-level geographic analytics (where demand/cancellations/
completions happen, over any historical window) is fully real. Driver-side
geography is real only as a live snapshot, same caveat as fleet
availability. No named regions — consistent with the standing Slice 2
decision, not a new gap.

## 2. What exists that Slice 4 should explicitly _not_ reuse

`apps/backend/src/analytics/` (`AnalyticsService`, `AnalyticsDailyMetric`)
already exists — checked directly, not assumed absent. It is **not** a fit
for this slice:

- Its `AnalyticsScopeType` enum is `PLATFORM`/`MERCHANT`/`RIDER` — the
  Marketplace/Delivery domain (orders, deliveries, merchants, delivery
  riders), not Ride/Driver/Operations.
- `recordMetric()`, the only way data enters `AnalyticsDailyMetric`, has
  **zero real call sites anywhere in the codebase** (grepped) — it's
  scaffolded but never wired into any domain event. Building Slice 4 on top
  of it would mean either leaving Operations Analytics silently empty
  forever, or reaching into Marketplace/Order domain code to start calling
  `recordMetric()` from Ride/Driver events — a much bigger, differently
  -scoped change than this slice, and outside DPX-OPS-001's boundary.

Recommendation: Slice 4 builds its own read-only aggregation queries
directly against `Ride`/`RideOffer`/`DriverShift`/`DriverAvailability`/
`OperationsCase`, the same live-query pattern every prior Operations slice
already uses (no new pre-aggregation table). One pure, non-domain-coupled
utility is worth reusing rather than duplicating: `analytics/period.helper.ts`
(`bucketDate`/`startOfUtcDay`/`listPeriodBuckets`) has no Marketplace
coupling at all — it's plain date-bucketing math, the same category of
reusable pure function as `haversineMeters` was for Slice 3, except this one
can be imported directly (it isn't inside a frozen module) rather than
duplicated.

## 3. Proposed Slice 4 scope, grounded only in what's real

- **Fleet snapshot analytics** — current online/offline/busy composition by
  vehicle type (no historical trend — flagged honestly, not invented).
- **Driver utilization** — trips completed, earnings, on-trip time vs. shift
  time, per driver or fleet-wide, over a selectable period.
- **Shift analytics** — active/break/ended counts, shift-length
  distribution, force-ended counts.
- **Ride demand/completion/cancellation** — volume by period and
  `rideType`, completion rate, cancellation rate by `cancelledBy` (honestly
  showing `SYSTEM` at zero), `NO_DRIVERS_FOUND` rate kept distinct from
  cancellation, top raw cancellation reasons.
- **Dispatch performance** — time-to-accept, offers-per-ride, decline/expire
  rate, repeated-offer-failure rate.
- **SOS/Incident/Support response times** — time-to-first-response,
  time-to-resolution, time-to-closure, volume by type/priority/status, all
  from the one `OperationsCase` table.
- **Geographic activity** — historical ride demand heatmap (pickup/dropoff),
  live driver-position snapshot (reusing Slice 1's existing data source, not
  a new query). No named regions.

**Explicitly not proposed**: any fleet-availability _trend_ chart, any
driver-position _movement_ trend, any named-region breakdown, or any metric
keyed off `analytics/`'s dormant Marketplace-scoped pre-aggregation table.
If the founder wants historical fleet/driver-position trends, that requires
a new event-logging table — a real schema decision this audit is
deliberately not making unilaterally, brought back for its own approval if
wanted.

## 4. Keeping it operational, not a generic BI dashboard

Per the founder's own direction (Slice 3 freeze approval): analytics stays
"operational rather than becoming a generic executive BI dashboard." Every
proposed metric above answers one of the same three questions every prior
slice's screens were built around: what's happening, what needs attention,
what should Operations do about it — e.g. a spike in `NO_DRIVERS_FOUND` rate
in a time window points at a real dispatch-capacity problem; a driver whose
utilization is unusually low might need a shift-pattern conversation; a
queue whose time-to-first-response is climbing needs staffing attention.
This is not proposed as export-heavy tables or vanity charts — the concrete
screen design is a later step, this audit only confirms the underlying data
is real.

## 5. Permissions

No existing permission fits read-only analytics access cleanly.
Recommending a new `operations:analytics:read`, following the exact
`OPERATIONS_PERMISSIONS` pattern Slices 1-2 established
(`operations.constants.ts`) — granted to `operations_staff`/
`administrator`/`super_administrator`, same grant set as every other
Operations permission. Not pre-decided here as final; flagged for
confirmation the same way Slice 1's reality audit flagged the app-placement
decision.

## 6. Figma Protection Rule — reaffirmed for this slice

Per `docs/DPX-OPS-001-FIGMA-PROTECTION-RULE.md`: Slice 4's screens are new
Operations-specific UI, built in `apps/operations-console/src/components/`
and `apps/operations-console/src/app/`, the same as every screen in Slices
1-3. No existing Figma-derived Ride/Marketplace/Wallet/Driver screen gets
touched, and if a shared `packages/ui` chart/table primitive is needed and
doesn't exist yet, it gets added as a new component or a strictly additive
extension — never a change to a Locked component's existing rendering. This
slice's own Production Audit will include the regression check that
document specifies.

## 7. Open question for founder review

Everything in §3 is buildable today with zero schema changes. The one real
design choice this audit surfaces rather than decides: whether "fleet
availability trend" and "driver-position movement trend" (both ❌ in §1)
are worth a **new** event-logging table as a deliberate, separately
-approved enhancement, or whether Slice 4 ships without them and that gap
stays documented rather than filled. Recommending the latter for Slice 4
itself (ship what's real now), with the former available as a future,
explicitly-scoped addition if the founder wants it.

Implementation begins once this scope is approved.
