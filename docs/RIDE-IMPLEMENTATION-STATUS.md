# Ride Implementation Status

Living dashboard for the Ride (passenger ride-hailing) backend program. Updated after
every RIDE-002.x milestone lands — this replaces scattering progress across PR
descriptions. See `docs/RIDE-001A-BACKEND-AUDIT.md` for the original reality audit and
`docs/RIDE-001B-ARCHITECTURE-SPEC.md` for the locked architecture decisions.

**Program goal (founder-set, unchanged):** a real passenger can request a ride, a
verified driver can accept it, both can track the trip in real time, the trip can be
completed, payment processed, and ratings recorded. Only after that is fully verified
does attention shift to the Ride Figma UI.

Last updated: RIDE-002.10 (locked no-OTP decision + GPS start gate), not yet merged —
see PR #50. **The Ride backend is now feature-complete and end-to-end verified.** Per
the founder's roadmap, no further RIDE-002.x backend milestones are planned — focus
shifts to RIDE-003 (Ride Customer UI integration against this backend).

## ✅ Completed

| Milestone   | What shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | PR / commit                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| RIDE-001A   | Backend reality audit — confirmed no passenger ride system existed                                                                                                                                                                                                                                                                                                                                                                                                                | `docs/RIDE-001A-BACKEND-AUDIT.md`     |
| RIDE-001B   | Architecture spec locked (ride types, fare shape, KYC docs, `DriverStatus` gate, WebSocket decision)                                                                                                                                                                                                                                                                                                                                                                              | `docs/RIDE-001B-ARCHITECTURE-SPEC.md` |
| RIDE-002.1  | Core Prisma models: `Ride`, `RideTracking`, `DriverAvailability`, `DriverKyc`, `DriverStatus` enum on `DriverProfile`                                                                                                                                                                                                                                                                                                                                                             | PR #50, commit `cd6bfc2`              |
| RIDE-002.2  | Driver KYC submission + admin review/approve/reject/suspend/reactivate                                                                                                                                                                                                                                                                                                                                                                                                            | PR #50, commit `82af93c`              |
| —           | KYC correction: Guarantor/Referee ID replaces National ID per founder decision                                                                                                                                                                                                                                                                                                                                                                                                    | PR #50, commit `0658e1b`              |
| RIDE-002.3  | Customer ride request/list/get/cancel, fare estimation (`RideFareService`, reuses `haversineMeters`)                                                                                                                                                                                                                                                                                                                                                                              | PR #50, commit `1ffa6e8`              |
| RIDE-002.4  | Dispatch: `RideOffer` model, nearest-eligible-driver matching, accept/decline, timeout sweep, reassignment up to `MAX_DISPATCH_ATTEMPTS`, ride/driver lifecycle notifications                                                                                                                                                                                                                                                                                                     | PR #50, commit `b0ea708`              |
| RIDE-002.5  | Realtime: `RideGateway` (JWT-authenticated WebSocket, `/rides` namespace), `ride:{id}`/`driver:{id}` rooms, driver location channel, `driver:ride:manage`-gated availability endpoint (`POST /driver/rides/availability`) — a real gap found during this milestone, since dispatch had no way for a driver to ever go online                                                                                                                                                      | PR #50, commit `62898c1`              |
| RIDE-002.6  | Trip lifecycle: `RideTripService` — DRIVER_ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED, plus driver-initiated cancel from DRIVER_ASSIGNED/ARRIVED (never once IN_PROGRESS). Fixed a real bug found along the way: customer cancellation of an already-assigned ride never freed the driver's `activeRideCount`, permanently blocking that driver from future dispatch                                                                                                            | PR #50, commit `bcba41e`              |
| RIDE-002.7  | Wallet & payment: post-completion payment screen (Cash / OPay / Wallet / Card), `WalletOwnerType` gains `DRIVER`+`PLATFORM`, platform wallet as settlement clearinghouse, `RidePaymentService`, driver wallet access, `OpayProvider` stub. Founder corrected the initial upfront-charge design to a post-completion flow mid-milestone — see design doc                                                                                                                           | PR #50, commit `aeea323`              |
| RIDE-002.8  | Post ride experience: `RideRating` (sibling to `Review`, two-sided category ratings), tip driver (100% to driver, no commission), digital receipt (`RideReceiptService`, read-only), report problem (`RideProblemReport` + admin resolve). Founder redirected scope from "just ratings" to the full flow mid-milestone — see design doc                                                                                                                                           | PR #50, commit `dced683`              |
| RIDE-002.9  | End-to-end verification: `ride-lifecycle.e2e.spec.ts`, 11 tests across 7 scenario groups (happy path, dispatch decline/reassign, offer timeout/reassign, cash, OPay, cancellation rules) wiring every real service together as the controllers do. Zero product defects found; two real gaps confirmed and flagged (no verification-code step, no SOS/emergency/trip-sharing) rather than fabricated or silently built — see verification report                                  | PR #50, commit `92014f8`              |
| RIDE-002.10 | Founder decision locked: no mandatory passenger OTP/PIN before ride start. GPS proximity gate added to `RideTripService.startTrip` instead (driver must be within 50m of pickup, reusing the existing `haversineMeters` utility and RIDE-002.5's tracked driver location) — zero new schema, zero change to the `Ride` status machine. Driver/vehicle-identity display (photo, vehicle photo, model, plate) intentionally not built — flagged as still open, not silently assumed | PR #50, pending push                  |

## 🔄 In Progress

Nothing actively in flight — RIDE-002.10 is complete pending commit/push and CI. Per
the founder's roadmap, the next milestone is **RIDE-003 — Ride Customer UI integration**
(replacing Figma mocks with real API/WebSocket calls against this backend), not a
further backend milestone.

## ⏳ Planned

| Milestone | Scope                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RIDE-003  | Integrate the approved Figma Ride Customer UI against the real backend — replace mocks with API calls, dummy state with React Query, fake tracking with the `RideGateway` WebSocket, fake payment/receipt/rating with `RidePaymentService`/`RideReceiptService`/`RideRatingService`. No redesign. |
| Post-003  | Driver UI integration, then Operations Console (live map, driver approval, ride monitoring, pricing, analytics, support), then closed beta and the Kano launch                                                                                                                                    |

## 🚫 Blocked

Nothing currently blocked.

## 🧪 Tests

Backend suite: **817/817 passing** as of RIDE-002.10 (up from 709 at RIDE-002.1, 743 at
RIDE-002.3, 757 at RIDE-002.4, 769 at RIDE-002.5, 776 at RIDE-002.6, 785 at RIDE-002.7,
804 at RIDE-002.8, 815 at RIDE-002.9). Ride-specific coverage:

- `ride.permissions.spec.ts` — customer + driver ride permission constants
- `ride-fare.service.spec.ts` — fare estimation math
- `rides.service.spec.ts` — request/list/get/cancel, real-DB, dispatch integration, driver-availability upsert, and the activeRideCount-on-cancel fix
- `ride-dispatch.service.spec.ts` — nearest-driver matching, `DriverStatus.APPROVED` gate, accept/decline/expire/reassign, `MAX_DISPATCH_ATTEMPTS` exhaustion, real-DB
- `ride-offer-sweep.service.spec.ts` — sweep delegation, reentrancy guard, timer lifecycle
- `ride-trip.service.spec.ts` — full arrive/start/complete walk, illegal-transition rejections, driver cancel + availability release, ownership check, plus RIDE-002.10's GPS proximity gate (too-far rejection, unknown-location rejection), real-DB
- `ride-payment.service.spec.ts` — wallet settlement (customer debit → platform → driver payout), insufficient-balance failure, cash confirmation (no wallet movement), gateway initiate/verify success and failure, double-pay and pre-completion rejection, an explicit platform-wallet reconciliation check, plus RIDE-002.8's tip cases (wallet tip moves real balances, cash tip moves none, unpaid-ride and double-tip rejection), real-DB
- `ride-rating.service.spec.ts` — both rating directions, duplicate-rating rejection, incomplete-ride rejection, no-driver-assigned rejection, ownership check, real-DB
- `ride-problem-report.service.spec.ts` — report creation, list-by-status, resolve, double-resolve rejection, not-found, real-DB
- `ride-receipt.service.spec.ts` — full receipt shape (driver/vehicle/fare/payment), null driver, incomplete-ride rejection, ownership check, real-DB
- `ride-lifecycle.e2e.spec.ts` — the RIDE-002.9 full-chain suite: happy path with WebSocket-event assertions at every transition, decline→reassign, timeout→reassign, dispatch exhaustion, cash, OPay gateway, and all four cancellation-rule combinations plus the IN_PROGRESS negative case, real-DB
- `ride.gateway.spec.ts` — handshake auth (missing/invalid/revoked token), room-join authorization, location throttling, best-effort publish
- `dto/request-ride-dto.validation.spec.ts` — request payload validation
- `driver.permissions.spec.ts`, `drivers.service.spec.ts`, `dto/driver-dto.validation.spec.ts` — driver KYC/approval flow
- `prisma-foundation.spec.ts` / `prisma-migration-seed.spec.ts` — schema + permission/role seed integrity, updated for every new model/permission

**Fixed during RIDE-002.5**: `ride-dispatch.service.spec.ts` and `rides.service.spec.ts`
had shared/overlapping fixture coordinates, which meant real-DB "nearest driver" queries
could occasionally pick up a driver created by the other spec file when both ran
concurrently against the same live database. Fixed by giving `ride-dispatch.service.spec.ts`
a geographically distinct fixture region — a flaky-test class worth watching for in any
future real-DB dispatch tests. **Recurred and was fixed again during RIDE-002.9**: within
the new e2e spec itself, a driver from an earlier scenario whose ride had completed
(freeing `activeRideCount` back to 0) could tie with a later scenario's driver on
identical coordinates and win dispatch instead. Fixed with the same `afterEach`
deactivation pattern used in `ride-dispatch.service.spec.ts`.

**Noted during RIDE-002.6 verification, recurring since**: full-suite runs under
`--maxWorkers=2` occasionally hit one unrelated suite-load crash — a different file each
time (`platform-stabilization.contract.spec.ts` at RIDE-002.6, `search.service.spec.ts`
at RIDE-002.7, `prisma-product-catalog.spec.ts` at RIDE-002.8). RIDE-002.9's verification
saw **no recurrence** — 815/815 clean on both a `--runInBand` run and a `--maxWorkers=2`
run. Still reads as sandbox-level Jest worker-startup flakiness, not a code regression —
worth fixing at the Jest config level eventually, but has not blocked any milestone.

## 📊 Coverage / reuse audit

Verified against the existing `delivery` dispatch engine (`AssignmentService`,
`TrackingService`) before writing RIDE-002.4, against Wallet/Ledger/Payment before
writing RIDE-002.7 (full findings in `docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md`), against
the `reviews` module and the schema at large before writing RIDE-002.8 (full findings in
`docs/RIDE-002.8-POST-RIDE-DESIGN.md`), and end-to-end across every milestone's
composition before closing out RIDE-002.9 (full findings in
`docs/RIDE-002.9-E2E-VERIFICATION.md`):

| Component                       | Existed already?                                                                                         | Reused as-is?                                                                                                                                    | Ride-specific difference                                                                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Haversine distance              | Yes (`delivery-fee.service.ts`)                                                                          | **Yes** — imported directly, zero duplication                                                                                                    | none                                                                                                                                                                                                                                                                                 |
| Nearest-candidate sort          | Yes (`AssignmentService.findNearestRider`)                                                               | Same shape, reimplemented                                                                                                                        | Ride eligibility also requires `DriverProfile.status === APPROVED` (delivery riders have no equivalent approval gate), a strict `activeRideCount === 0` cap (vs. delivery's `< 3` batching), and exclusion of drivers with any other pending offer (a concept delivery doesn't have) |
| Timeout / reassignment          | **No** — confirmed absent; single synchronous pick, no retry loop                                        | New                                                                                                                                              | Built from scratch: `RideOffer` state machine (PENDING/ACCEPTED/DECLINED/EXPIRED), 15s timeout, lazy sweep, capped retries; verified end-to-end in RIDE-002.9's Scenarios 2/3                                                                                                        |
| Notification flow               | Yes (`NOTIFICATION_SERVICE` port + `notifyDeliveryLifecycle`)                                            | **Yes** — same port pattern, added `notifyRideLifecycle`/`notifyRideEarning` alongside it; `notifyRideEarning` reused as-is for tip payouts      | Ride-specific events (`ride_offered`, `ride_assigned`, `ride_no_drivers_found`, `ride_payment_succeeded`/`_failed`)                                                                                                                                                                  |
| Location update flow            | Yes (`TrackingService`, throttled, delivery-job-scoped)                                                  | Pattern reused (same throttle constant), new service (`RideGateway`'s location handler)                                                          | RIDE-002.5                                                                                                                                                                                                                                                                           |
| `WalletService`                 | Yes — credit/debit/refund/settlement/cashback/withdrawal/transfer, idempotent                            | **Yes** — zero modifications; ride settlement and tips both compose `debit`+`credit` pairs (not `transfer()`, which lacks reference idempotency) | New `WalletOwnerType` values (`DRIVER`, `PLATFORM`) added via additive migration                                                                                                                                                                                                     |
| Payment → wallet linkage        | **No** — order payments never touched the wallet; `WalletEventsSubscriber`'s payment handler was a no-op | New                                                                                                                                              | RIDE-002.7 builds the first payment-to-wallet settlement pattern in this codebase                                                                                                                                                                                                    |
| Gateway adapters                | Yes (`PaystackProvider`, `FlutterwaveProvider`, `MoniepointProvider` stub)                               | **Yes** — same `PaymentProviderAdapter` interface reused directly, no capture/refund added                                                       | `OpayProvider` added following the exact `MoniepointProvider` stub precedent (throws until real credentials exist); the full initiate→verify→settle loop is verified end-to-end in RIDE-002.9's Scenario 5                                                                           |
| `Review` / ratings              | Yes — genuinely polymorphic (`targetType`/`targetId`), single overall `rating: Int`                      | **No** — deliberately not extended; new sibling `RideRating` model                                                                               | Two-sided (customer↔driver), per-ride category sub-ratings, `@@unique([rideId, raterRole])` — shapes `Review`'s verified-purchase/aggregate/moderation design never anticipated                                                                                                      |
| Support/ticket system           | **No** — confirmed absent by a schema-wide search                                                        | New                                                                                                                                              | `RideProblemReport` is a scoped stand-in (`OPEN`/`RESOLVED`, admin resolve), not a real support platform — flagged as a future gap, not fabricated                                                                                                                                   |
| Vehicle details                 | **No** — only `DriverAvailability.vehicleType` (a category, not plate/model/colour) exists anywhere      | N/A                                                                                                                                              | Digital receipt surfaces what's actually available rather than inventing plate/model/colour fields                                                                                                                                                                                   |
| Ride history                    | Yes — `GET /customer/rides` + wallet transaction endpoints already cover it                              | **Yes** — no new work needed                                                                                                                     | none                                                                                                                                                                                                                                                                                 |
| Verification-code / PIN step    | **No** — confirmed absent during RIDE-002.9's audit                                                      | **Resolved** — founder locked "no mandatory OTP" in RIDE-002.10                                                                                  | GPS proximity gate on `startTrip` substituted instead, reusing `haversineMeters` and RIDE-002.5's tracked driver location — zero new schema                                                                                                                                          |
| Driver/vehicle identity display | **No** — no photo, vehicle photo, model, or plate field exists anywhere in the schema                    | N/A                                                                                                                                              | Named by the founder as part of the "safety measures instead of OTP" set (RIDE-002.10), but not explicitly instructed to be built now — flagged as still open, not silently assumed or built                                                                                         |
| SOS / emergency / trip sharing  | **No** — confirmed absent by a targeted search of the `rides` module and schema                          | N/A                                                                                                                                              | A real passenger-safety gap, deliberately not built inside RIDE-002.9's verification-only scope per the founder's own instruction — flagged for an explicit founder decision on timing, not deferred silently                                                                        |

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
- ~~**Verification-code / PIN confirmation**~~ — **Decided (RIDE-002.10):** no mandatory
  passenger OTP/PIN. GPS proximity check on `startTrip` substituted instead. Optional
  ride verification (e.g. for a future women-only or corporate ride tier) remains a
  possible later enhancement, per the founder, but is explicitly not part of the core
  Ride backend.
- **Driver/vehicle identity display**: passenger-facing driver photo, vehicle photo,
  vehicle model, and plate number were named by the founder as the safety measures that
  replace OTP (RIDE-002.10) — none of these fields exist anywhere in the schema today
  (confirmed absent since RIDE-002.8's audit). Not built yet because the founder's
  explicit instruction covered the OTP removal and the GPS check, not this display;
  needs a decision on scope (which fields, photo upload/storage approach) before it's
  built.
- **SOS / emergency / trip sharing**: confirmed absent by RIDE-002.9's audit — no panic
  button, no live trip-sharing link, no emergency escalation path exists anywhere in
  the backend. Deliberately not built during the RIDE-002.9 verification milestone
  (a real new feature, not a minimal fix for a verification gap). Needs an explicit
  founder decision on whether this ships before or after the Kano beta.
