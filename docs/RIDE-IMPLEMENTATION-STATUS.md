# Ride Implementation Status

Living dashboard for the Ride (passenger ride-hailing) backend program. Updated after
every RIDE-002.x milestone lands — this replaces scattering progress across PR
descriptions. See `docs/RIDE-001A-BACKEND-AUDIT.md` for the original reality audit and
`docs/RIDE-001B-ARCHITECTURE-SPEC.md` for the locked architecture decisions.

**Program goal (founder-set, unchanged):** a real passenger can request a ride, a
verified driver can accept it, both can track the trip in real time, the trip can be
completed, payment processed, and ratings recorded. Only after that is fully verified
does attention shift to the Ride Figma UI.

Last updated: RIDE-002.8 (post ride experience), not yet merged — see PR #50.

## ✅ Completed

| Milestone  | What shipped                                                                                                                                                                                                                                                                                                                                                           | PR / commit                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| RIDE-001A  | Backend reality audit — confirmed no passenger ride system existed                                                                                                                                                                                                                                                                                                     | `docs/RIDE-001A-BACKEND-AUDIT.md`     |
| RIDE-001B  | Architecture spec locked (ride types, fare shape, KYC docs, `DriverStatus` gate, WebSocket decision)                                                                                                                                                                                                                                                                   | `docs/RIDE-001B-ARCHITECTURE-SPEC.md` |
| RIDE-002.1 | Core Prisma models: `Ride`, `RideTracking`, `DriverAvailability`, `DriverKyc`, `DriverStatus` enum on `DriverProfile`                                                                                                                                                                                                                                                  | PR #50, commit `cd6bfc2`              |
| RIDE-002.2 | Driver KYC submission + admin review/approve/reject/suspend/reactivate                                                                                                                                                                                                                                                                                                 | PR #50, commit `82af93c`              |
| —          | KYC correction: Guarantor/Referee ID replaces National ID per founder decision                                                                                                                                                                                                                                                                                         | PR #50, commit `0658e1b`              |
| RIDE-002.3 | Customer ride request/list/get/cancel, fare estimation (`RideFareService`, reuses `haversineMeters`)                                                                                                                                                                                                                                                                   | PR #50, commit `1ffa6e8`              |
| RIDE-002.4 | Dispatch: `RideOffer` model, nearest-eligible-driver matching, accept/decline, timeout sweep, reassignment up to `MAX_DISPATCH_ATTEMPTS`, ride/driver lifecycle notifications                                                                                                                                                                                          | PR #50, commit `b0ea708`              |
| RIDE-002.5 | Realtime: `RideGateway` (JWT-authenticated WebSocket, `/rides` namespace), `ride:{id}`/`driver:{id}` rooms, driver location channel, `driver:ride:manage`-gated availability endpoint (`POST /driver/rides/availability`) — a real gap found during this milestone, since dispatch had no way for a driver to ever go online                                           | PR #50, commit `62898c1`              |
| RIDE-002.6 | Trip lifecycle: `RideTripService` — DRIVER_ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED, plus driver-initiated cancel from DRIVER_ASSIGNED/ARRIVED (never once IN_PROGRESS). Fixed a real bug found along the way: customer cancellation of an already-assigned ride never freed the driver's `activeRideCount`, permanently blocking that driver from future dispatch | PR #50, commit `bcba41e`              |
| RIDE-002.7 | Wallet & payment: post-completion payment screen (Cash / OPay / Wallet / Card), `WalletOwnerType` gains `DRIVER`+`PLATFORM`, platform wallet as settlement clearinghouse, `RidePaymentService`, driver wallet access, `OpayProvider` stub. Founder corrected the initial upfront-charge design to a post-completion flow mid-milestone — see design doc                | PR #50, commit `aeea323`              |
| RIDE-002.8 | Post ride experience: `RideRating` (sibling to `Review`, two-sided category ratings), tip driver (100% to driver, no commission), digital receipt (`RideReceiptService`, read-only), report problem (`RideProblemReport` + admin resolve). Founder redirected scope from "just ratings" to the full flow mid-milestone — see design doc                                | PR #50, pending push                  |

## 🔄 In Progress

Nothing actively in flight — RIDE-002.8 is complete pending commit/push and CI.

## ⏳ Planned

| Milestone  | Scope                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RIDE-002.9 | Final end-to-end backend integration milestone — verify the complete request → dispatch → accept → arrive → start → complete → payment → settlement → receipt → rating → wallet → notifications chain |
| Post-002.9 | Ride Figma UI integration — passenger app, driver app, operations console, Kano pilot                                                                                                                 |

## 🚫 Blocked

Nothing currently blocked.

## 🧪 Tests

Backend suite: **804/804 passing** as of RIDE-002.8 (up from 709 at RIDE-002.1, 743 at
RIDE-002.3, 757 at RIDE-002.4, 769 at RIDE-002.5, 776 at RIDE-002.6, 785 at RIDE-002.7).
Ride-specific coverage:

- `ride.permissions.spec.ts` — customer + driver ride permission constants
- `ride-fare.service.spec.ts` — fare estimation math
- `rides.service.spec.ts` — request/list/get/cancel, real-DB, dispatch integration, driver-availability upsert, and the activeRideCount-on-cancel fix
- `ride-dispatch.service.spec.ts` — nearest-driver matching, `DriverStatus.APPROVED` gate, accept/decline/expire/reassign, `MAX_DISPATCH_ATTEMPTS` exhaustion, real-DB
- `ride-offer-sweep.service.spec.ts` — sweep delegation, reentrancy guard, timer lifecycle
- `ride-trip.service.spec.ts` — full arrive/start/complete walk, illegal-transition rejections, driver cancel + availability release, ownership check, real-DB
- `ride-payment.service.spec.ts` — wallet settlement (customer debit → platform → driver payout), insufficient-balance failure, cash confirmation (no wallet movement), gateway initiate/verify success and failure, double-pay and pre-completion rejection, an explicit platform-wallet reconciliation check, plus RIDE-002.8's tip cases (wallet tip moves real balances, cash tip moves none, unpaid-ride and double-tip rejection), real-DB
- `ride-rating.service.spec.ts` — both rating directions, duplicate-rating rejection, incomplete-ride rejection, no-driver-assigned rejection, ownership check, real-DB
- `ride-problem-report.service.spec.ts` — report creation, list-by-status, resolve, double-resolve rejection, not-found, real-DB
- `ride-receipt.service.spec.ts` — full receipt shape (driver/vehicle/fare/payment), null driver, incomplete-ride rejection, ownership check, real-DB
- `ride.gateway.spec.ts` — handshake auth (missing/invalid/revoked token), room-join authorization, location throttling, best-effort publish
- `dto/request-ride-dto.validation.spec.ts` — request payload validation
- `driver.permissions.spec.ts`, `drivers.service.spec.ts`, `dto/driver-dto.validation.spec.ts` — driver KYC/approval flow
- `prisma-foundation.spec.ts` / `prisma-migration-seed.spec.ts` — schema + permission/role seed integrity, updated for every new model/permission

**Fixed during RIDE-002.5**: `ride-dispatch.service.spec.ts` and `rides.service.spec.ts`
had shared/overlapping fixture coordinates, which meant real-DB "nearest driver" queries
could occasionally pick up a driver created by the other spec file when both ran
concurrently against the same live database. Fixed by giving `ride-dispatch.service.spec.ts`
a geographically distinct fixture region — a flaky-test class worth watching for in any
future real-DB dispatch tests.

**Noted during RIDE-002.6 verification, recurring since**: full-suite runs under
`--maxWorkers=2` occasionally hit one unrelated suite-load crash — a different file each
time (`platform-stabilization.contract.spec.ts` at RIDE-002.6, `search.service.spec.ts`
at RIDE-002.7, `prisma-product-catalog.spec.ts` at RIDE-002.8 — always "class extends
undefined" or "X is not a constructor" at module-load time). Every occurrence passes
cleanly in isolation and under `--runInBand`; RIDE-002.8's verification confirmed this
again (804/804 clean on both a `--runInBand` run and a clean `--maxWorkers=2` re-run
after the one-off crash). Still reads as sandbox-level Jest worker-startup flakiness,
not a code regression — worth fixing at the Jest config level eventually, but not
blocking any milestone so far.

## 📊 Coverage / reuse audit

Verified against the existing `delivery` dispatch engine (`AssignmentService`,
`TrackingService`) before writing RIDE-002.4, against Wallet/Ledger/Payment before
writing RIDE-002.7 (full findings in `docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md`), and
against the `reviews` module and the schema at large before writing RIDE-002.8 (full
findings in `docs/RIDE-002.8-POST-RIDE-DESIGN.md`):

| Component                | Existed already?                                                                                         | Reused as-is?                                                                                                                                    | Ride-specific difference                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Haversine distance       | Yes (`delivery-fee.service.ts`)                                                                          | **Yes** — imported directly, zero duplication                                                                                                    | none                                                                                                                                                                                                                                                                                 |
| Nearest-candidate sort   | Yes (`AssignmentService.findNearestRider`)                                                               | Same shape, reimplemented                                                                                                                        | Ride eligibility also requires `DriverProfile.status === APPROVED` (delivery riders have no equivalent approval gate), a strict `activeRideCount === 0` cap (vs. delivery's `< 3` batching), and exclusion of drivers with any other pending offer (a concept delivery doesn't have) |
| Timeout / reassignment   | **No** — confirmed absent; single synchronous pick, no retry loop                                        | New                                                                                                                                              | Built from scratch: `RideOffer` state machine (PENDING/ACCEPTED/DECLINED/EXPIRED), 15s timeout, lazy sweep, capped retries                                                                                                                                                           |
| Notification flow        | Yes (`NOTIFICATION_SERVICE` port + `notifyDeliveryLifecycle`)                                            | **Yes** — same port pattern, added `notifyRideLifecycle`/`notifyRideEarning` alongside it; `notifyRideEarning` reused as-is for tip payouts      | Ride-specific events (`ride_offered`, `ride_assigned`, `ride_no_drivers_found`, `ride_payment_succeeded`/`_failed`)                                                                                                                                                                  |
| Location update flow     | Yes (`TrackingService`, throttled, delivery-job-scoped)                                                  | Pattern reused (same throttle constant), new service (`RideGateway`'s location handler)                                                          | RIDE-002.5                                                                                                                                                                                                                                                                           |
| `WalletService`          | Yes — credit/debit/refund/settlement/cashback/withdrawal/transfer, idempotent                            | **Yes** — zero modifications; ride settlement and tips both compose `debit`+`credit` pairs (not `transfer()`, which lacks reference idempotency) | New `WalletOwnerType` values (`DRIVER`, `PLATFORM`) added via additive migration                                                                                                                                                                                                     |
| Payment → wallet linkage | **No** — order payments never touched the wallet; `WalletEventsSubscriber`'s payment handler was a no-op | New                                                                                                                                              | RIDE-002.7 builds the first payment-to-wallet settlement pattern in this codebase                                                                                                                                                                                                    |
| Gateway adapters         | Yes (`PaystackProvider`, `FlutterwaveProvider`, `MoniepointProvider` stub)                               | **Yes** — same `PaymentProviderAdapter` interface reused directly, no capture/refund added                                                       | `OpayProvider` added following the exact `MoniepointProvider` stub precedent (throws until real credentials exist)                                                                                                                                                                   |
| `Review` / ratings       | Yes — genuinely polymorphic (`targetType`/`targetId`), single overall `rating: Int`                      | **No** — deliberately not extended; new sibling `RideRating` model                                                                               | Two-sided (customer↔driver), per-ride category sub-ratings, `@@unique([rideId, raterRole])` — shapes `Review`'s verified-purchase/aggregate/moderation design never anticipated                                                                                                      |
| Support/ticket system    | **No** — confirmed absent by a schema-wide search                                                        | New                                                                                                                                              | `RideProblemReport` is a scoped stand-in (`OPEN`/`RESOLVED`, admin resolve), not a real support platform — flagged as a future gap, not fabricated                                                                                                                                   |
| Vehicle details          | **No** — only `DriverAvailability.vehicleType` (a category, not plate/model/colour) exists anywhere      | N/A                                                                                                                                              | Digital receipt surfaces what's actually available rather than inventing plate/model/colour fields                                                                                                                                                                                   |
| Ride history             | Yes — `GET /customer/rides` + wallet transaction endpoints already cover it                              | **Yes** — no new work needed                                                                                                                     | none                                                                                                                                                                                                                                                                                 |

## 📌 Business decisions still required

- **Fare rates**: `RIDE_FARE_RATES` (base/per-km/per-minute for Economy and Tricycle) are
  engineering placeholders anchored to delivery's fee magnitude, not approved pricing.
  Needs explicit sign-off before the Kano pilot.
- **`RIDE_PLATFORM_COMMISSION_RATE`**: currently `0.15`, an engineering placeholder —
  needs founder sign-off before production, same discipline as fare rates.
- **Cash commission collection**: commission owed on cash rides is computed and
  recorded (Ride fields + audit log) but not actually collected from the driver — needs
  a product decision (deduct from next digital payout? running payable balance?).
- **OPay real integration**: registered as a stubbed provider (mirrors the existing
  `MoniepointProvider` pattern); needs real OPay merchant credentials before it can
  process a payment.
- **Driver payout/withdrawal workflow**: `WalletService.withdrawal()` is a raw ledger
  primitive; there's no bank-account-linked request/approval flow for drivers to
  actually cash out yet.
- **`WalletLedgerEntry` missing unique constraint**: discovered during RIDE-002.1's
  migration replay — declared in `schema.prisma` but never actually migrated in
  production. Deliberately not bundled into Ride work. Needs a duplicate-row check
  before applying a fix.
- **Support ticket system**: `RideProblemReport` (RIDE-002.8) is a scoped stand-in, not
  a real support platform — no SLAs, no agent assignment, no customer-facing thread.
  A dedicated support/ticketing milestone is a real gap for a future release.
- **Vehicle details**: no plate number, model, or colour exists anywhere in the schema
  (driver KYC/onboarding never capture it). The RIDE-002.8 receipt reflects that
  honestly; capturing real vehicle data is a driver-onboarding gap.
- **Tip amount limits**: capped at ₦1–₦100,000 as an engineering sanity bound, not a
  founder-approved ceiling.
