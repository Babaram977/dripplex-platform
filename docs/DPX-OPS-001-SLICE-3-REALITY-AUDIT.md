# DPX-OPS-001 Slice 3 — Dispatch Management: Reality Audit & Plan

Founder-approved to begin (2026-08-05), immediately after the Slice 2 freeze,
with an explicit instruction: audit before implementing, and keep the
standing `docs/DPX-RIDE-201-OPERATIONS-MANUAL-DISPATCH.md` boundary —
Operations may inspect live rides, assignment state, nearby/eligible
drivers, ETA, and related dispatch information; manual reassignment must
not mutate the frozen Ride lifecycle yet. Same discipline as every prior
slice: read the real code before scoping, don't assume DPX-RIDE-201's own
claims are still accurate a session later without re-checking them.

**Scope of this audit**: Phase 1's Dispatch Oversight bullet list from
`docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md` — "live ride queue, driver
allocation, manual reassignment, trip monitoring, cancellation monitoring."
Live ride queue is **already shipped** (Slice 1's `OperationsRideQueueService`)
— this audit covers what Slice 3 still needs to add: a ride detail view,
driver allocation history, the DPX-RIDE-201 decision-support panel
(eligible drivers/availability/ETA/ratings), trip monitoring, and
cancellation monitoring.

## 1. DPX-RIDE-201's own claims, re-verified against real code

DPX-RIDE-201 (written 2026-08-04) named four specific pieces of existing
capability the visibility-half of Slice 3 should reuse. Each was re-read
against the actual source this session, not assumed still accurate:

| DPX-RIDE-201 claim                                                                                  | Re-verified                                            | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Same `haversineMeters`-style distance calculation... `RideTrackingReadService.getNearbyDrivers()`" | `apps/backend/src/rides/ride-tracking-read.service.ts` | ✅ Real, but confirmed **not directly reusable as-is** — it privacy-fuzzes coordinates (`fuzzForPrivacy`, ~11m rounding), caps at 20 results, and returns no driver identity at all (public pre-booking map use case). Slice 3 needs its own operations-side query using the same `haversineMeters` + `DriverAvailability` filtering shape, not a call into this method — exactly as DPX-RIDE-201 itself said ("full-fidelity... driver-identified").                                                              |
| "`DriverAvailability.online`/`acceptingRides`/`activeRideCount`"                                    | `schema.prisma` `DriverAvailability` model             | ✅ Real, unchanged. Also has `latitude`/`longitude`/`vehicleType`, all nullable-safe, indexed `(online, acceptingRides, vehicleType)`.                                                                                                                                                                                                                                                                                                                                                                             |
| "ETA... matching the pattern the fare-estimate endpoint already uses"                               | `apps/backend/src/rides/ride-fare.service.ts`          | ⚠️ Real, but worth stating precisely: it's a **constant-speed straight-line estimate** (`distanceMeters / DEFAULT_RIDE_SPEED_MPS`), not a routing/traffic-aware duration. "Not a fabricated number" is accurate — it's a real, consistently-applied formula the rest of the platform already trusts for fare estimates — but it is not more precise than that anywhere else on the platform either. Slice 3 should present it as an estimate, not a promise, same honesty bar the fare estimate itself is held to. |
| "`RideRating` aggregate... `DriversService.getOwnPerformanceStats` already does"                    | `apps/backend/src/drivers/drivers.service.ts:141`      | ✅ Real, method exists exactly as described: `prisma.rideRating.aggregate({ where: { rateeId, raterRole: CUSTOMER }, _avg, _count })`. Read-only, reusable pattern (not the method itself, which is scoped to "own" driver — Slice 3 needs the same query shape against an arbitrary candidate driver id).                                                                                                                                                                                                         |

**Conclusion**: DPX-RIDE-201's technical claims hold up. Nothing was
invented or has drifted since it was written. The one nuance worth
recording precisely (not a correction, a clarification) is the ETA
estimate's actual precision — already flagged above.

## 2. What Slice 1 already shipped for this area

`OperationsRideQueueService.getRideQueue()` (`apps/backend/src/operations/
operations-ride-queue.service.ts`) already reads every "live" `Ride` row
(`REQUESTED`/`SEARCHING`/`DRIVER_ASSIGNED`/`ARRIVED`/`IN_PROGRESS`),
summarized into pending/assigned/in-progress counts, surfaced on the
existing `/rides` operations-console page. This is genuinely "live ride
queue" from the Dispatch Oversight list — already done, not part of
Slice 3's remaining scope. Slice 3 adds a **ride detail view** reachable
from this queue (today's queue rows have no click-through), plus the four
items below.

## 3. Driver allocation — real data, not currently surfaced

`RideOffer` (`apps/backend/prisma/schema.prisma`) is the real, complete
record of dispatch attempts per ride: `driverId`, `status` (`PENDING` /
`ACCEPTED` / `DECLINED` / `EXPIRED`), `offeredAt`, `expiresAt`,
`respondedAt`. `RideDispatchService.dispatchRide()`
(`apps/backend/src/rides/ride-dispatch.service.ts`) creates one offer per
attempt, retrying the next-nearest eligible candidate up to
`MAX_DISPATCH_ATTEMPTS`, giving up (status → `NO_DRIVERS_FOUND`) if
exhausted. `RideOfferSweepService` lazily expires stale offers. **All of
this is real and already written — nothing needs to change in `rides/` to
read it.** A ride detail view can show "who was offered this ride, in what
order, and what happened" by reading `RideOffer` rows for that `rideId`,
read-only, the same cross-module-read pattern every other
`operations/` service already uses.

## 4. Trip monitoring — real data available, no live-position stream needed for v1

`RideTracking` rows (`rideId`, `latitude`/`longitude`, `heading`, `speed`,
`createdAt`) are the same breadcrumb trail `RideTrackingReadService.
getTrackingHistory()` already serves to the ride's own customer (MAPS-UI
Slice 2/4). A ride detail view can read the same table for any in-progress/
completed ride, operations-side — no new write path, no new table. Real-time
push is **not required for v1**: `RideGateway` (`apps/backend/src/rides/
ride.gateway.ts`) only broadcasts into per-ride (`ride:{id}`) and per-driver
(`driver:{id}`) Socket.IO rooms — there is no operations-wide broadcast
room today, and adding one would mean touching the frozen gateway. Every
other DPX-OPS-001 screen (Slice 1's fleet map/ride queue, Slice 2's queues)
already established the platform's own precedent for this exact situation:
15s polling, not a websocket subscription. Trip monitoring follows the same
precedent — a ride detail view polling `RideTracking` on the same cadence,
not a gateway change.

## 5. Cancellation monitoring — real fields, one status nuance worth naming precisely

`Ride.cancelledAt`/`cancelledBy` (`RideCancelledBy`: `CUSTOMER`/`DRIVER`/
`SYSTEM`)/`cancellationReason` are real columns, populated by real code
paths: `RidesService.cancelRide()` stamps `CUSTOMER` (+ optional reason from
`dto.reason`), `RideTripService`'s driver-cancel path stamps `DRIVER`.
**One nuance to get right, not a gap**: a ride that exhausts dispatch
retries (`RideDispatchService.giveUp()`) moves to `RideStatus.
NO_DRIVERS_FOUND`, a distinct status from `CANCELLED` — it is not stamped
`cancelledBy: SYSTEM`, despite the `SYSTEM` enum value existing (grepped:
zero call sites currently write `cancelledBy: RideCancelledBy.SYSTEM`
anywhere in the codebase). A cancellation-monitoring view needs to treat
"cancelled" (has `cancelledAt`/`cancelledBy`) and "no drivers found"
(`status === NO_DRIVERS_FOUND`, no `cancelledBy`) as two distinct, both-real
outcomes rather than conflating them — an honest reflection of what the
platform actually distinguishes today, not an invented unification.

## 6. Manual reassignment — stays exactly where DPX-RIDE-201 left it

No change to that document's rule. Slice 3 ships the "Reassign Driver"
control with the real decision-support panel (§3-§5's data) behind it and
**no reassignment action wired up**. If, while building the panel, a case
emerges where the _decision-support_ view itself would benefit from a
`rides/` read that doesn't exist yet (none identified by this audit — every
data point named above is already readable without touching `rides/`),
that comes back to the founder before it's built, per DPX-RIDE-201's own
"what activating this document later requires" section — not assumed or
silently expanded.

## 7. Permissions

No new permission is needed for the visibility-only scope. `operations:
live:read` (Slice 1's permission, already granted to `operations_staff`/
`administrator`/`super_administrator`) already gates
`OperationsRideQueueService` and is the natural fit for a read-only ride
detail view extending it. Whether the (currently inert) "Reassign Driver"
button eventually needs its own higher-bar permission is explicitly
deferred to DPX-RIDE-201's own activation requirements — not decided here,
since the button does nothing yet.

## 8. Proposed Slice 3 scope (visibility-only, for founder review)

1. **Ride detail view** (`operations-console`, new `/rides/[id]` route) —
   reads `Ride` by id (status, customer, driver, fare, timestamps), the
   same permission as the existing ride queue.
2. **Driver allocation history** — `RideOffer` rows for the ride, ordered
   by `offeredAt`, showing status/response time per attempt.
3. **Trip monitoring** — `RideTracking` breadcrumb for in-progress/
   completed rides, polled on the platform's established 15s cadence.
4. **Cancellation detail** — `cancelledAt`/`cancelledBy`/
   `cancellationReason` when present, `NO_DRIVERS_FOUND` shown as its own
   distinct outcome per §5.
5. **"Reassign Driver" decision-support panel** (DPX-RIDE-201) — eligible
   nearby drivers (new operations-side query, full-fidelity/driver-
   identified, same `haversineMeters`/`DriverAvailability` filtering shape
   as the customer-facing one but not calling into it directly),
   availability, ETA (constant-speed estimate, honestly labeled), and
   rating (same aggregate shape as `getOwnPerformanceStats`, generalized
   to an arbitrary candidate driver id). **No reassignment action.**

All five items are readable today without a single change to
`apps/backend/src/rides/` — confirmed by this audit, not assumed. Same
architecture discipline as Slices 1-2: a new read surface inside
`operations/`, composing existing tables and reusing established query
shapes, never a duplicate of `rides/`'s own business logic.

## Next step

This audit is submitted for founder review before implementation begins,
per the founder's own instruction. Pending approval, implementation
proceeds under the same governance as Slice 2: Implement → Verify →
Document → Production Audit → Founder Review → Freeze.
