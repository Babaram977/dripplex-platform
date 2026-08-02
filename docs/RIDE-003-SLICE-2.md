# RIDE-003 — Slice 2: Active Ride

## Implemented screens

Real source, ported (colors/spacing/typography preserved exactly):
`DriverAssignedScreen`, `DriverEnRouteScreen`, `RideInProgressScreen`,
`LiveTrackingScreen`.

Generated, extending the same locked design language (see
`docs/RIDE-003-GENERATED-SCREENS.md` for the full record on each):
`DriverProfileSheet`, `DriverArrivedScreen` (base).

## Reusable component library

Per the founder's instruction, `ride-ui.tsx` now holds every shared Ride
primitive instead of screens re-implementing card/button/sheet markup
inline: `RideHeader`, `RideBottomSheet` (renamed from `BottomSheet`),
`ActionButton` (renamed from `GreenButton`, now with `primary`/`secondary`/
`danger` variants), `QuickActionButton` (the compact icon-over-label style
used in 2-3-button rows — Call/Chat/Cancel/Share/SOS), `DriverCard`,
`ETAChip`, `FareBreakdown`, `StatusBanner`, plus the existing
`RideStatusBar`/`BackArrow`/`SafetyChip`/`MapCanvas`. Slice 1's screens
(`FareEstimateScreen`, `FindingDriverScreen`, `DestinationSearchScreen`)
were refactored to use the renamed/new primitives rather than left on the
old names, so the whole Ride surface is now on one component set, not two.

Also new: `useRideStatusTransition` (`hooks/rides/`) — a small hook that
watches a ride's real status (WS push + poll fallback, same infra as
Slice 1) and fires a callback the moment it reaches a target status. Every
active-ride screen transition (`assigned → arrived`, `arrived → in
progress`, etc.) is driven by this off real backend state, not local
timers — replacing the received screens' `setTimeout`-based mock
transitions entirely.

## Backend APIs consumed

No new backend endpoints this slice (Slice 1's `POST
/customer/rides/estimate` was the only addition). Everything here reuses:
`GET /customer/rides/:id` (status polling fallback), `POST
/customer/rides/:id/cancel`, and the WS namespace `/rides` (`ride:status`,
`ride:driver_location`).

## SDK methods

None new — `sdk.rides.getRide`, `sdk.rides.cancelRide`, existing.

## WebSocket events

`ride:status` (patches the cached ride, drives every transition) and
`ride:driver_location` (drives the honest distance-remaining/distance-to-
pickup displays via client-side haversine — see below). `ride:payment` and
`ride:offered` aren't relevant yet (Slice 3/backend-internal respectively).

## The driver-identity gap (confirmed, not new)

Re-verified against current code before building anything:
`DriverProfileDto` (`packages/types/src/driver/index.ts`) has no vehicle
make/model/color/plate/photo field anywhere in its schema — only KYC
compliance documents. And there's no customer-facing endpoint to read it at
all: only `admin` (`admin-drivers.controller.ts`) and the driver's own
`driver` controller can access driver profiles
(`apps/backend/src/drivers/controllers/`). For an active ride, the only
real data a customer can get about their driver is the opaque
`RideDto.driverId` and live lat/lng over the socket.

Handled as instructed — not stopped, not faked:

- `DriverCard` (shared component) shows a generic vehicle icon and "Your
  driver" label with an honest note that name/photo/vehicle aren't
  available yet, instead of the received mock's fabricated "Adeyemi
  Okafor" / rating / plate.
- `DriverProfileSheet` (generated) keeps the visual shell but its content
  is an explicit "integration status" list — every field named, each
  marked as pending a backend addition, not silently blank.
- **Proposed backend addition** (not built — this is schema + cross-domain
  PII exposure, a product/privacy decision for the founder to scope, unlike
  the fare-estimate endpoint which only exposed existing pure logic):
  `GET /customer/rides/:id/driver`, gated to rides the requesting customer
  owns and only once `status` is `DRIVER_ASSIGNED` or later, returning
  first name, a rating (needs a driver-rating aggregate — doesn't exist
  yet either), and vehicle info (needs new schema fields — vehicle
  make/model/color/plate don't exist on `DriverProfile` or anywhere else
  today).

## The no-verify-code / no-waiting-fee adaptation

Confirmed in `ride-trip.service.ts`: `markArrived`/`startTrip`/
`completeTrip`/`cancelByDriver` are all driver-initiated (take `driverId`,
called from `driver-rides.controller.ts`, never customer-reachable).
`startTrip` is gated on GPS proximity
(`RIDE_START_PROXIMITY_METERS`/`requireDriverNearPickup`), not a
passenger-entered code — `RIDE-002.10`'s own comment states this is a
deliberate founder-locked decision ("no mandatory passenger OTP/PIN"). No
waiting-fee field exists anywhere in the schema either. The customer
therefore has zero action to take between `ARRIVED` and `IN_PROGRESS`
beyond optionally cancelling — reflected honestly in the generated
`DriverArrivedScreen`, which has no verify-code UI and no "Start Ride"
button (see `docs/RIDE-003-GENERATED-SCREENS.md`).

## Honest derived data (not fabricated)

- **Distance to pickup / distance remaining**: computed client-side via
  haversine (`lib/geo.ts` — the same formula `RideFareService` uses
  server-side, duplicated intentionally as generic geometry, not business
  logic) between the live WS driver location and the ride's real
  pickup/dropoff coordinates. Shown as "X.Xkm", never a fabricated ETA
  minute count (no assumed speed).
- **Elapsed time** (`RideInProgressScreen`): real, from `ride.startedAt`.
- **Trip progress bar**: `1 - (remainingMeters / totalMeters)`, both real
  distances.
- **Fare shown throughout**: `ride.totalFare`, fixed at booking — the
  backend doesn't do metered/live fare adjustment, so no live fare ticking
  was invented.

## Disabled, not silently missing

Call/Message (`DriverAssignedScreen`, `DriverEnRouteScreen`) and Share
Trip/SOS/Call (`LiveTrackingScreen`) are visibly present (per "keep the UI
exactly as designed") but disabled, each with an explicit note that no
telephony/chat/trip-sharing/emergency capability exists in the backend —
confirmed absent via the RIDE-002.9 e2e spec's own comment ("no
verification-code/PIN step and no SOS/emergency/trip-sharing feature exist
anywhere in the backend").

## Flow

`home → search → fare → finding →` (on `DRIVER_ASSIGNED`) `→ assigned →`
(via "Track driver live") `→ enroute →` (on `ARRIVED`) `→ arrived →` (on
`IN_PROGRESS`) `→ inprogress ⇄ liveTracking`. `assigned` also opens
`driverProfile` as a drill-in sheet. Every transition arrow above fires off
real `RideDto.status` changes via `useRideStatusTransition`, not a local
timer or button press standing in for backend state.

Known simplification, not a defect: pressing "back" on any active-ride
screen returns to Home rather than showing a persistent "resume active
ride" banner there. The ride itself is untouched server-side (only Cancel
actually cancels) — this is a real gap worth a follow-up, not something
this slice's scope covered.

## Verification

- `apps/customer-web`: `npx tsc --noEmit` clean; `npx eslint` clean across
  all new/changed Ride files; `npx vitest run` 4/4 passed (unchanged); `npm
run build` clean — `/ride` route present (25.0 kB, up from 22.1 kB in
  Slice 1).
- Backend/SDK: unchanged this slice (no new endpoints), so Slice 1's
  verification stands (776/776 backend, 64/64 SDK).

### Playwright walkthrough — honest result

This sandbox has **no Postgres, no Docker, and no `DATABASE_URL` anywhere**
(confirmed directly: `pg_isready` fails, `docker ps` can't reach a daemon,
no `.env` file exists in `apps/backend`). Starting the real backend
(`npm run dev`) fails immediately with `Invalid environment configuration:
DATABASE_URL: Required; REDIS_URL: Required; JWT_ACCESS_SECRET: Required;
JWT_REFRESH_SECRET: Required`. A full live walkthrough — request a ride,
have a driver accept, watch every real status transition — is not possible
in this environment without provisioning infrastructure, which is out of
this slice's scope.

What _was_ verified with Playwright, against the real running `next dev`
server: loading `/ride` unauthenticated redirects to `/login` (client-side,
via the same `DashboardAuthGate`/`useRequireAuth` every other authenticated
route uses), the login page renders with zero console/page errors, and the
production build confirms the route compiles and is statically generated
cleanly. That's genuine evidence the routing and auth-gating layer works;
it is not evidence the active-ride flow works end-to-end against a live
backend, and this report doesn't claim otherwise. Confirming the full
happy path needs either a Railway-connected environment or local Postgres

- Redis provisioned in this sandbox — flagging as a prerequisite for
  whoever next has infrastructure access, rather than working around it with
  a fake walkthrough.

## Defects found

None in already-shipped backend code this slice — the driver-identity and
verify-code gaps above are absent capabilities, not bugs. The
`WalletPaySuccessScreen` duplicate-export issue (from Slice 1) remains a
chunking artifact in the reference doc, unrelated to Slice 2's screens.

## Stop condition

Per instruction: stopping here. Slice 3 (Ride Completion) not started.
