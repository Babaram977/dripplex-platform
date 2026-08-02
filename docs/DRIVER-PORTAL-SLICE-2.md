# Driver Portal — Slice 2: Dashboard + Incoming Ride Experience

Launch Mode priority 1 (see the founder's Kano-launch pivot): build the
Driver Portal's ride-driving UI, reusing existing backend/SDK capability and
adding only the minimum backend surface genuinely missing. This slice covers
build-order items 1 (Dashboard) and 2 (Incoming Ride Experience) from the
founder's spec. Slice 1 (already committed) added the offer-preview
endpoint and the `DriverRideClient`/`DriverProfileClient` SDK surface.

## Backend additions (minimum required, all tested)

The driver-side ride REST surface was otherwise complete. Three read
capabilities were genuinely missing — a driver had no way to recover their
own state after a page refresh or see their own ride history — so they were
added:

- `GET /driver/rides/availability` — `RidesService.getOwnAvailability()`.
  Lets the dashboard show current online/offline state on load instead of
  only after the driver toggles it.
- `GET /driver/rides/active` — `RidesService.getActiveRide()`. Recovers
  "you have a trip in progress" after a refresh; `acceptOffer`/`arrive`/
  `start` all return the updated `RideDto` directly, but nothing persisted
  that reference client-side before this.
- `GET /driver/rides` — `RidesService.listOwnRidesForDriver()`, a driver-side
  mirror of the existing `GET /customer/rides`. Backs both this slice's
  dashboard earnings/trip-count widget and Slice 4's Ride History screen.

All three are additive, permission-gated by the existing
`driver:ride:manage` permission, and covered by new tests in
`rides.service.spec.ts` (13 new assertions) plus SDK contract tests in
`driver-ride-client.spec.ts`. No schema changes.

## What was built

**Dashboard (`/`)** — `OnlineToggleCard` (online/offline switch, vehicle
type selector, geolocation-backed lat/lng on toggle), `ActiveTripSummaryCard`
(shown only when `getActiveRide` returns a ride), `DashboardStatsCard`
(today's earnings/trips, this week's earnings, wallet balance — earnings
derived client-side from `RideDto.driverEarning` on the driver's own
completed rides, not re-computed), `ReferralPromoSummaryCard` (compact view
of the existing Driver Growth Campaign dashboard — "referral progress" and
"promotion status" both map onto that same campaign data; there is no
separate driver-facing promotions feed). The full campaign UI (referral
code, detailed tier progress) moved from `/` to a new `/campaign` route to
make room for the ride dashboard; nothing was removed, only relocated.

**Incoming Ride Experience** — `IncomingRideModal`, driven by
`useRideOffers` (polls `GET /driver/rides/offers`) and
`useRideOfferSocket` (WS `ride:offered` push invalidates the offers query;
best-effort, same posture as customer-web's ride hooks — the poll is the
fallback). Shows countdown (from `RideOfferPreviewDto.expiresAt`),
pickup distance (Haversine, computed client-side from the driver's own
geolocation against `pickupLatitude`/`pickupLongitude` — no backend field
for this exists or was needed), estimated fare, trip distance/duration, and
Accept/Decline actions. Auto-dismisses when the countdown reaches zero and
refetches so an expired offer disappears. The existing `ride_offered` push
notification (wired in RIDE-002.4/DPX-CORE-001, real FCM delivery per
DPX-CORE-001 Phase D) needed no changes — Phase D-3's tap-to-navigate
already lands the driver back on this dashboard.

The offer preview deliberately does not show the passenger's name or phone
(see `RideOfferPreviewDto`'s doc comment from Slice 1) — this matches how
Uber/Bolt-style dispatch works and was an explicit design decision, not an
oversight.

## Capability gap identified, deferred (not blocking this slice)

`RideDto` never exposes the customer's name or phone to the driver, even
after the driver accepts. Slice 1's own doc comment assumed identity
"becomes visible via RideDto" post-acceptance — that assumption was wrong on
closer inspection. This doesn't block Slice 2 (the incoming-offer preview is
correctly identity-free by design), but it will block Slice 3's Active Ride
Workflow, where a driver needs to be able to contact the passenger while
en route to pickup. Tracked for Slice 3, not fixed here.

`DriverProfileDto` has no vehicle fields (make/model/plate/color) — the
online-toggle card can only collect a `RideType` (Economy/Tricycle), not
actual vehicle details. Tracked for Slice 4 (Driver Profile), where it
belongs per the founder's build order.

## Verification

Backend: `tsc --noEmit` clean, `jest src/rides` 101/101 passing, ESLint
clean. SDK: rebuilt, `vitest run src/rides/driver-ride-client.spec.ts`
16/16 passing. Driver portal: `tsc --noEmit` clean, `eslint --max-warnings=0`
clean, `vitest run` 10/10 passing, `next build` succeeds (all 9 routes,
including the new `/campaign`).
