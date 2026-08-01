# RIDE-002.8 — Post Ride Experience Design Note

Written before implementation, per the founder's redirect: RIDE-002.8 is not "just
ratings" but the complete post-ride flow — Ride Completed → Payment → Receipt →
Passenger Rating → Driver Rating → Tip Driver (optional) → Report Problem → Ride
History — treated as one milestone.

## Reality audit (verified before writing code)

**`Review` model** (`apps/backend/prisma/schema.prisma`) is genuinely polymorphic —
`authorId`, `targetType: ReviewTargetType`, `targetId`, single overall `rating: Int
(1-5)`, no category sub-ratings. `ReviewTargetType` is `PRODUCT | MERCHANT | RIDER`.
**Decision: do not extend it.** Same principle applied throughout this program
(`DeliveryJob` was never modified for Ride in RIDE-001B; `RidePaymentTransaction` was
kept as a sibling to the order-scoped `PaymentTransaction` in RIDE-002.7). `Review`'s
`verifiedPurchase` logic, `ReviewAggregate` rollups, and moderation queue were designed
for product/merchant reviews left by one party about another — not a per-ride,
two-sided exchange with category sub-ratings (Driving/Cleanliness/Professionalism from
the passenger; Behaviour/Waiting time/Payment experience from the driver). Retrofitting
that shape onto `Review` risked destabilizing the live marketplace review system for no
real benefit. A new sibling model, `RideRating`, was added instead.

**No support/ticket system exists anywhere in this codebase** — confirmed via a
schema-wide search for `support|ticket|complaint` returning zero matches. This directly
contradicts the founder's assumption of an "existing support system" for Report Problem
to integrate with. Rather than fabricate an integration that doesn't exist, a small,
honestly-scoped `RideProblemReport` model was added — it stands in as the "ticket" for
now (`OPEN`/`RESOLVED`, an admin resolve action) until a real support platform is built.
That's a real gap worth flagging for a future milestone, not something to paper over.

**No vehicle details exist anywhere in the schema** — driver KYC, onboarding, and
`DriverAvailability` were all checked. The only vehicle-related field anywhere is
`DriverAvailability.vehicleType`, an `ECONOMY | TRICYCLE` category, not a plate number,
model, or colour. The digital receipt therefore surfaces what's actually available
(driver name, phone, vehicle type category) rather than fabricating plate/model/colour
fields the founder's "Exactly like Uber" description implied. Capturing real vehicle
details is a real gap for a future driver-onboarding milestone, not something this
milestone invents data for.

**Ride history** was already fully served by existing endpoints — `GET
/customer/rides` (list with pagination) plus the wallet transaction endpoints from
RIDE-002.7 (`GET /customer/wallet/transactions`, `GET /driver/wallet/transactions`).
No new storage or endpoints were needed; this is documented as "no new work required,"
not silently skipped.

## What was built

- **`RideRating`** (sibling model, not a `Review` extension): `raterRole`
  (`CUSTOMER`/`DRIVER`), `raterId`, `rateeId`, overall `rating` (1-5), optional
  `comment`, optional `categoryRatings` JSON. `@@unique([rideId, raterRole])` enforces
  exactly one rating per direction per ride — a customer rating a driver twice on the
  same ride is a real conflict (409), not a silent overwrite. Only allowed once the
  ride is `COMPLETED`. `POST /customer/rides/:id/rate-driver`, `POST
/driver/rides/:id/rate-customer`.
- **Tip driver**: `RidePaymentService.tipDriver` — 100% of the tip goes to the driver,
  no platform commission, so unlike fare settlement it never routes through the
  platform wallet clearinghouse. Wallet/gateway-paid rides move a direct
  `debit(customer)` + `credit(driver)` pair (both idempotent via the new
  `ride_tip` reference type, `referenceId = rideId`); cash-paid rides only record
  `Ride.tipAmount` — the passenger hands cash directly to the driver, same treatment
  as the cash fare itself. Requires the ride to already be `PAID`; one tip per ride.
  `POST /customer/rides/:id/tip`.
- **Digital receipt**: `RideReceiptService.getReceipt` — a pure read model composed
  from the existing `Ride` row plus the driver's `User` and `DriverAvailability`
  records. No new storage. Only available once the ride is `COMPLETED`. `GET
/customer/rides/:id/receipt`.
- **Report problem**: `RideProblemReport` (category: `WRONG_FARE` / `DRIVER_BEHAVIOUR`
  / `UNSAFE_DRIVING` / `LOST_ITEM` / `VEHICLE_ISSUE` / `OTHER`, optional description).
  `POST /customer/rides/:id/report` for passengers; `GET /admin/ride-reports` and
  `POST /admin/ride-reports/:id/resolve` for staff, gated behind a new
  `admin:rides:support` permission (granted to `operations_staff`, `administrator`,
  `super_administrator`).
- **Ride history**: no new work — existing `GET /customer/rides` and wallet
  transaction endpoints already cover it (see audit above).

## Business decisions still required

- **Support ticket system**: `RideProblemReport` is a scoped stand-in, not a real
  support platform (no SLAs, no agent assignment, no customer-facing thread/replies).
  A dedicated support/ticketing milestone is a real gap for a future release.
- **Vehicle details**: no plate number, model, or colour exists anywhere in the
  schema. The receipt reflects that honestly today; capturing real vehicle data is a
  driver-onboarding gap, not a RIDE-002.8 concern.
- **Tip amount limits**: capped at ₦1–₦100,000 as an engineering sanity bound, not a
  founder-approved ceiling.

## Quality gates run for this milestone

- `prisma validate` / `prisma migrate diff` re-check — clean, only the four
  pre-existing unrelated drift statements remain (unchanged since RIDE-002.1)
- Migration applied via `prisma migrate deploy` against a fresh local Postgres
- Backend typecheck — clean
- Backend lint — clean
- Full backend test suite — 804/804 passing (up from 785 at RIDE-002.7), run both
  `--runInBand` and `--maxWorkers=2`
- New coverage: `ride-rating.service.spec.ts` (both rating directions, duplicate
  rejection, incomplete-ride rejection, no-driver rejection, ownership check),
  `ride-problem-report.service.spec.ts` (report, list-by-status, resolve, double-resolve
  rejection, not-found), `ride-receipt.service.spec.ts` (full receipt shape, null
  driver, incomplete-ride rejection, ownership check), and four new cases appended to
  `ride-payment.service.spec.ts` for tipping (wallet tip moves real balances, cash tip
  moves none, unpaid-ride rejection, double-tip rejection)
