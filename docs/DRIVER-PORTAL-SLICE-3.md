# Driver Portal — Slice 3: Active Ride Workflow + Navigation

Build-order items 3 (Active Ride Workflow) and 8 (Navigation) from the
founder's Driver Portal spec. Unlike Slices 1–2, this slice required **no
new backend endpoints** — the driver-side trip lifecycle
(`RideTripService.markArrived/startTrip/completeTrip/cancelByDriver`,
`RidePaymentService.confirmCash`, `RideRatingService.rateCustomer`) was
already fully wired via `DriverRidesController` and already covered by the
Slice 1 SDK audit. The work here is entirely UI plus one client-side-only
addition (location reporting) that uses an existing, previously-unused
backend WS handler.

## What was built

**`/trip`** — a single static route, not `/trip/[id]`. A driver has at
most one active ride at a time (`GET /driver/rides/active`, added in
Slice 2), so there's no driver-facing "get ride by id" endpoint and none
was needed. The page is a state machine keyed off `RideDto.status`:

- **`DRIVER_ASSIGNED`** — pickup address, "Navigate to pickup" (opens a
  Google Maps directions deep link — see Navigation below), "I've
  arrived" (`markArrived`), "Cancel trip" (`cancelByDriver`).
- **`ARRIVED`** — "Start trip" (`startTrip`). Surfaces the backend's own
  proximity-gate error message directly ("too far from pickup") rather
  than a generic failure, since founder-locked policy
  (RIDE-002.10/`RIDE_START_PROXIMITY_METERS`) makes that a real, expected
  rejection a driver needs to understand, not a bug.
- **`IN_PROGRESS`** — elapsed-time counter (from `startedAt`), dropoff
  address, "Navigate to dropoff", "End trip" (`completeTrip`).
- **`COMPLETED`** — `TripFareSummary` (fare breakdown + driver earning,
  cash-confirmation button when `paymentMethod === 'CASH'` and unpaid) and
  `CustomerRatingForm` (`rateCustomer`). Both reuse fields already present
  on the `RideDto` the `completeTrip` mutation returns directly — there is
  no separate driver receipt endpoint (the customer's
  `GET /customer/rides/:id/receipt` is filtered strictly by `customerId`
  and wasn't reused), and none was needed since `RideDto` already carries
  every fare/earning field a receipt needs.

**Live location reporting** (`useReportDriverLocation`, wired into
`AppShell` while `online`) — streams the driver's position to
`RideGateway`'s existing `driver:location` WS handler
(`apps/backend/src/rides/ride.gateway.ts`), throttled client-side to match
`RIDE_LOCATION_THROTTLE_MS`. That handler already does two things with it
that nothing was previously feeding: keeps `DriverAvailability.latitude/
longitude` fresh (which `startTrip`'s pickup-proximity gate reads — without
this, "Start trip" would almost always fail with "Driver location is not
available") and broadcasts `ride:driver_location` to the customer's ride
room for live tracking. No backend change — the handler already existed
and was simply never called by any client.

**Navigation** — no Google Maps JS SDK integration exists anywhere in this
codebase (confirmed again this slice; `MapCanvas` remains the same
documented decorative placeholder from RIDE-003, now ported into
driver-portal with an identical container/framing contract so a real
embedded map is a drop-in replacement later). Real navigation is provided
today via a `https://www.google.com/maps/dir/?api=1&destination=…` deep
link into the driver's own installed Maps app — genuine turn-by-turn
navigation, zero API key required, not a placeholder.

## Capability gap re-affirmed, still not fixed

`RideDto` still never exposes the passenger's name or phone to the driver
(see docs/DRIVER-PORTAL-SLICE-2.md). `PassengerCard` documents this
honestly, mirroring customer-web's `DriverCard`, which has the identical
gap in the opposite direction and was left undocumented-but-unfixed by the
same design choice in RIDE-003. Not fixed here either: every Active Ride
Workflow action (arrive/start/complete/rate) works correctly without it,
and inventing a passenger-contact endpoint is a real product/privacy
decision (should the driver get a phone number? a masked proxy number?) —
outside "minimum backend additions required to complete the driver
workflow."

## Known limitation

The completed-trip fare summary and rating form live in page-local state
holding the `RideDto` the `completeTrip` mutation returned — `useActiveRide`
itself goes back to `null` once status is `COMPLETED`. A page refresh
between completing a trip and finishing the rating loses that view (the
driver lands on the dashboard's empty active-trip state instead). Accepted
for MVP: the complete→rate flow is a single continuous interaction in
normal use, and Ride History (Slice 4) will be the durable place to review
a past trip's fare summary after the fact.

## Verification

Driver portal: `tsc --noEmit` clean, `eslint --max-warnings=0` clean,
`vitest run` 10/10 passing, `next build` succeeds (10 routes, including
the new `/trip`). No backend changes this slice — full backend/SDK suites
from Slice 2 remain the last verified state (101/101 rides tests, SDK
16/16).
