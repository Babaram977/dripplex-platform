# RIDE-003 — Slice 1: Ride Request

Real visual source: `docs/reference/rideScreen-figma-make-source.tsx` (24
real Figma Make screens received in chat, now the locked design language
per the founder's "VISUAL SOURCE LOCKED" decision). Screens ported for this
slice — `RideHomeScreen`, `DestinationSearchScreen`, `FareEstimateScreen`,
`FindingDriverScreen` — use their real colors/spacing/typography exactly
(background `#060E1C`/`#0A1628`, cards `#0D1B2E`, surface `#112238`, primary
green `#2BAC52`, Poppins/Inter). `DriverAssignedScreen` (also received) is
deliberately deferred to Slice 2 — see "Scoped out" below.

## Route

`apps/customer-web/src/app/(ride)/ride/` — new `(ride)` route group,
full-screen, no `Sidebar`/`DashboardHeader`/`BottomNavigation` shell, gated
by the same `DashboardAuthGate` every other authenticated route uses. This
resolves the shell-placement question flagged in
`docs/RIDE-003-READINESS.md`: every real screen uses
`position: absolute; inset: 0` full-bleed layout with its own status bar,
which only makes sense standalone.

## Backend change (genuine integration-defect fix)

`FareEstimateScreen` needs a fare _before_ the customer commits to booking.
The real backend only computed fare as a side effect of `POST
/customer/rides` (ride creation) — there was no way to preview one. The
calculation itself already existed as a pure function
(`RideFareService.estimate()`, already unit-tested in
`ride-fare.service.spec.ts`), just never exposed. Added:

- `POST /customer/rides/estimate` (`CustomerRidesController.estimateFare`) —
  thin wrapper, no persistence, reuses the existing service exactly.
- `EstimateRideFareDto` (`apps/backend/src/rides/dto/request-ride.dto.ts`).
- `EstimateRideFareRequest` / `EstimateRideFareResponse` types
  (`packages/types/src/ride/index.ts`).
- `CustomerRideClient.estimateFare()` (`packages/sdk`).
- `useEstimateFare()` hook (`apps/customer-web/src/hooks/rides/use-ride-fare.ts`).

This is the only backend change in Slice 1, and it's exposure of existing
logic, not new business logic — consistent with the founder's "genuine
integration-defect fixes only" rule.

## Hooks used

`useSavedPlaces` (real `CustomerAddress` book, pre-dates Ride), `useAuth`
(first name), `useEstimateFare` (new), `useRequestRide`, `useRide`,
`useRideTracking` (WS `ride:status` cache patch, + a 4s poll fallback since
the gateway is documented best-effort), `useCancelRide`. All pre-existing
except `useEstimateFare` and `useCurrentLocation` (new — see gaps).

## Capability gaps hit and how they were handled (not silently faked)

1. **No place-autocomplete/geocoding endpoint.** `DestinationSearchScreen`
   can only search the customer's real saved places client-side — free-text
   entry that doesn't match a saved place returns "no results," not
   fabricated suggestions.
2. **No current-location endpoint.** Pickup coordinates come from the
   browser's own Geolocation API (`useCurrentLocation`) — a real frontend
   capability, not a backend one, and not faked. Denied/unavailable states
   are shown honestly (fare estimation is blocked until location is
   available).
3. **`RideType` is only `ECONOMY` | `TRICYCLE`** in the real backend — the
   Figma Make mock data's "Comfort"/"XL" types don't exist and aren't
   offered.
4. **`MapCanvas` is decorative SVG, not a real map.** The Figma Make
   source's own checklist calls for a Google Maps SDK swap; no Maps
   integration exists anywhere in this codebase. Kept as the same
   decorative route illustration the design specifies rather than faking a
   live map.

## Scoped out of Slice 1 (belongs to Slice 2)

`DriverAssignedScreen` was received as real source but isn't wired here.
`RideDto.driverId` is a bare ID — the real backend has no endpoint
returning a driver's name/photo/vehicle/rating for a ride that isn't yet
completed (the most significant gap from the original Phase 1 audit).
Rather than fabricate that driver card, `FindingDriverScreen` shows an
honest "Driver found!" transition state when the real ride status reaches
`DRIVER_ASSIGNED`, and Slice 2 picks up from there once that endpoint gap
is resolved or otherwise addressed.

## Verification

- Backend: `apps/backend` — `npx tsc --noEmit` clean; `npx jest src/rides`
  94/94 passed; full suite 776/776 passed (2 pre-existing suite-load
  failures unrelated to this change — `fraud.service.spec.ts` and
  `platform-stabilization.contract.spec.ts` fail on `PrismaClient`
  construction in this sandbox, confirmed via `git status` to touch neither
  file).
- `packages/types`: builds clean.
- `packages/sdk`: builds clean; `npx vitest run` 64/64 passed (62 → 64, the
  2 new `CustomerRideClient` tests).
- `apps/customer-web`: `npx tsc --noEmit` clean; `npx eslint` clean on all
  new files; `npx vitest run` 4/4 passed (unchanged — no existing test
  needed updating); `npm run build` clean, `/ride` now appears in the route
  table (21 routes, up from 20).
