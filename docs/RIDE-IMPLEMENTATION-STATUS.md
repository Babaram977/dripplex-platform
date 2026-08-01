# Ride Implementation Status

Living dashboard for the Ride (passenger ride-hailing) backend program. Updated after
every RIDE-002.x milestone lands — this replaces scattering progress across PR
descriptions. See `docs/RIDE-001A-BACKEND-AUDIT.md` for the original reality audit and
`docs/RIDE-001B-ARCHITECTURE-SPEC.md` for the locked architecture decisions.

**Program goal (founder-set, unchanged):** a real passenger can request a ride, a
verified driver can accept it, both can track the trip in real time, the trip can be
completed, payment processed, and ratings recorded. Only after that is fully verified
does attention shift to the Ride Figma UI.

Last updated: RIDE-002.4 (dispatch), not yet merged — see PR #50.

## ✅ Completed

| Milestone  | What shipped                                                                                                                                                                  | PR / commit                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| RIDE-001A  | Backend reality audit — confirmed no passenger ride system existed                                                                                                            | `docs/RIDE-001A-BACKEND-AUDIT.md`     |
| RIDE-001B  | Architecture spec locked (ride types, fare shape, KYC docs, `DriverStatus` gate, WebSocket decision)                                                                          | `docs/RIDE-001B-ARCHITECTURE-SPEC.md` |
| RIDE-002.1 | Core Prisma models: `Ride`, `RideTracking`, `DriverAvailability`, `DriverKyc`, `DriverStatus` enum on `DriverProfile`                                                         | PR #50, commit `cd6bfc2`              |
| RIDE-002.2 | Driver KYC submission + admin review/approve/reject/suspend/reactivate                                                                                                        | PR #50, commit `82af93c`              |
| —          | KYC correction: Guarantor/Referee ID replaces National ID per founder decision                                                                                                | PR #50, commit `0658e1b`              |
| RIDE-002.3 | Customer ride request/list/get/cancel, fare estimation (`RideFareService`, reuses `haversineMeters`)                                                                          | PR #50, commit `1ffa6e8`              |
| RIDE-002.4 | Dispatch: `RideOffer` model, nearest-eligible-driver matching, accept/decline, timeout sweep, reassignment up to `MAX_DISPATCH_ATTEMPTS`, ride/driver lifecycle notifications | PR #50, pending push                  |

## 🔄 In Progress

Nothing actively in flight — RIDE-002.4 is complete pending commit/push and CI.

## ⏳ Planned

| Milestone  | Scope                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| RIDE-002.5 | WebSocket gateway — driver location push, passenger live ride status, replaces the REST-polling + sweep dispatch model from 002.4             |
| RIDE-002.6 | Trip lifecycle: Driver Assigned → Arrived → Picked Up → In Progress → Completed → Cancelled, `RideTracking` GPS logging during an active trip |
| RIDE-002.7 | Wallet/payment integration reuse for ride fares (mirrors `delivery`/`order` payment flow)                                                     |
| RIDE-002.8 | Ratings/reviews reuse for completed rides (mirrors existing `reviews` module)                                                                 |
| Post-002.8 | Ride Figma UI integration — passenger app, driver app, operations console, Kano pilot                                                         |

## 🚫 Blocked

Nothing currently blocked.

## 🧪 Tests

Backend suite: **757/757 passing** as of RIDE-002.4 (up from 709 at RIDE-002.1, 743 at
RIDE-002.3). Ride-specific coverage:

- `ride.permissions.spec.ts` — customer + driver ride permission constants
- `ride-fare.service.spec.ts` — fare estimation math
- `rides.service.spec.ts` — request/list/get/cancel, real-DB, includes dispatch integration
- `ride-dispatch.service.spec.ts` — nearest-driver matching, `DriverStatus.APPROVED` gate, accept/decline/expire/reassign, `MAX_DISPATCH_ATTEMPTS` exhaustion, real-DB
- `ride-offer-sweep.service.spec.ts` — sweep delegation, reentrancy guard, timer lifecycle
- `dto/request-ride-dto.validation.spec.ts` — request payload validation
- `driver.permissions.spec.ts`, `drivers.service.spec.ts`, `dto/driver-dto.validation.spec.ts` — driver KYC/approval flow
- `prisma-foundation.spec.ts` / `prisma-migration-seed.spec.ts` — schema + permission/role seed integrity, updated for every new model/permission

## 📊 Coverage / reuse audit

Verified against the existing `delivery` dispatch engine (`AssignmentService`,
`TrackingService`) before writing RIDE-002.4, per the founder's request:

| Component              | Delivery has it?                                                             | Reused as-is?                                                                             | Ride-specific difference                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Haversine distance     | Yes (`delivery-fee.service.ts`)                                              | **Yes** — imported directly, zero duplication                                             | none                                                                                                                                                                                                                                                                                 |
| Nearest-candidate sort | Yes (`AssignmentService.findNearestRider`)                                   | Same shape, reimplemented                                                                 | Ride eligibility also requires `DriverProfile.status === APPROVED` (delivery riders have no equivalent approval gate), a strict `activeRideCount === 0` cap (vs. delivery's `< 3` batching), and exclusion of drivers with any other pending offer (a concept delivery doesn't have) |
| Timeout / reassignment | **No** — confirmed absent; single synchronous pick, no retry loop            | New                                                                                       | Built from scratch: `RideOffer` state machine (PENDING/ACCEPTED/DECLINED/EXPIRED), 15s timeout, lazy sweep, capped retries                                                                                                                                                           |
| Notification flow      | Yes (`NOTIFICATION_SERVICE` port + `notifyDeliveryLifecycle`)                | **Yes** — same port pattern, added `notifyRideLifecycle` alongside it (not a replacement) | Ride-specific events (`ride_offered`, `ride_assigned`, `ride_no_drivers_found`)                                                                                                                                                                                                      |
| Wallet hooks           | No — delivery doesn't touch wallet at dispatch either, only at order payment | N/A                                                                                       | Correctly out of scope until RIDE-002.7                                                                                                                                                                                                                                              |
| Location update flow   | Yes (`TrackingService`, throttled, delivery-job-scoped)                      | Not yet — `RideTracking` model exists but no service                                      | Deferred to RIDE-002.6 (a ride only needs live tracking once `DRIVER_ASSIGNED`, i.e. after dispatch)                                                                                                                                                                                 |

## 📌 Business decisions still required

- **Fare rates**: `RIDE_FARE_RATES` (base/per-km/per-minute for Economy and Tricycle) are
  engineering placeholders anchored to delivery's fee magnitude, not approved pricing.
  Needs explicit sign-off before the Kano pilot.
- **`WalletLedgerEntry` missing unique constraint**: discovered during RIDE-002.1's
  migration replay — declared in `schema.prisma` but never actually migrated in
  production. Deliberately not bundled into Ride work. Needs a duplicate-row check
  before applying a fix.
