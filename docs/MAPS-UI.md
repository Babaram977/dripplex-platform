# Maps UI — Real Google Maps Frontend Integration

Founder-directed Phase 1 Launch Priority: replace the decorative
`MapCanvas` SVG placeholder in customer-web and driver-portal with a real
Google Maps JavaScript API integration, now that the backend reverse
geocoder and credentials are wired (docs/LAUNCH-READINESS-CREDENTIALS.md).
Delivered in four slices on `ride-002-implementation`.

## What's real now

**customer-web** (`apps/customer-web/src/components/ride/`)

| Screen                     | Map behavior                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                       | Current-location-centered map, pins for nearby available drivers                                                                                                      |
| Destination Search         | Google Places Autocomplete resolves free-text addresses; saved places remain a fallback                                                                               |
| Fare Estimate              | Draggable pickup pin, real driving route to destination, live ETA/distance                                                                                            |
| Finding Driver             | Pickup-centered map                                                                                                                                                   |
| Driver Assigned / En Route | Live driver marker + driving route to pickup; ETA chip prefers the real Directions-API distance over the haversine estimate                                           |
| Driver Arrived             | Driver + pickup markers close together, tight zoom                                                                                                                    |
| Ride In Progress           | Driver marker + route to dropoff; "View live tracking" is now an overlay button (a real interactive map can't sit inside a `<button>`, unlike the old decorative SVG) |
| Live Tracking              | Full-screen driver-to-dropoff route                                                                                                                                   |
| Trip Receipt               | Traveled-route replay — pickup/dropoff pins plus the actual `RideTracking` breadcrumb polyline for the completed trip                                                 |

**driver-portal** (`apps/driver-portal/src/components/ride/`, `app/trip/page.tsx`)

| Section     | Map behavior                                  |
| ----------- | --------------------------------------------- |
| Assigned    | Driver's own live position + route to pickup  |
| Arrived     | Driver + pickup markers, tight zoom           |
| In Progress | Driver's own live position + route to dropoff |

The existing `buildDirectionsUrl` "Navigate to pickup/dropoff" deep-link
buttons (`lib/maps.ts`) are kept as-is alongside the embedded map — real
turn-by-turn navigation still opens the device's own Maps app; the
embedded map is for at-a-glance context, not full navigation.

## What's still the SVG placeholder

`MapCanvas` itself is untouched and still exists in both apps — it's the
fallback rendered by `LiveMap` whenever `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
isn't configured, so every screen above keeps working in any environment
without Maps credentials set up (local dev without a key, CI, etc).
`TripCompletedScreen` (the celebratory "You have arrived!" screen, distinct
from `TripReceiptScreen`) was left without a map — no design slot for one
in its centered summary-card layout, and the traveled-route replay already
lives on the Receipt screen a few taps later.

## Architecture

- **Library**: `@vis.gl/react-google-maps` (Google's own maintained React
  wrapper), added to both apps. Classic `Marker`/`Polyline` components are
  used, not `AdvancedMarker` — that requires a Cloud-based Map ID, an extra
  Google Cloud Console setup step not done this pass (tracked in
  LAUNCH-READINESS-CREDENTIALS.md as a post-launch upgrade).
- **`LiveMap`** (one per app — `apps/customer-web/src/components/ride/live-map.tsx`,
  `apps/driver-portal/src/components/ride/live-map.tsx`): the shared
  primitive. Dark-styled (`DARK_MAP_STYLES`, Google's standard night-mode
  JSON) to match the app's UI instead of default light Google Maps.
  Renders pickup/dropoff/driver/nearby-driver markers, auto-fits the
  camera to whatever points are present, and — given a `routeBetween`
  pair — fetches a real driving route from the Directions API
  (`useMapsLibrary('routes')`) and renders it as a `Polyline` via the
  response's `overview_polyline` encoded string, exposing distance/duration
  text through `onRouteChange`. Falls back to the pre-existing `MapCanvas`
  SVG when no API key is configured. The two apps' `LiveMap` files are
  near-duplicates by design — this repo already duplicates ride-hooks
  logic per app rather than sharing a package (see
  `use-ride-tracking.ts`/`use-report-driver-location.ts`), and this follows
  the same precedent rather than introducing a new shared package
  mid-feature.
- **`RideMapsProvider`** (customer-web only, `ride-maps-provider.tsx`):
  wraps `RideFlow`'s screen switch in a single `APIProvider` so the Maps JS
  script loads once for the whole ride flow instead of remounting on every
  Home→Search→Fare→tracking screen transition. driver-portal's trip page
  doesn't need this — `LiveMap` mounts its own `APIProvider` per render,
  which `@vis.gl/react-google-maps` is designed to dedupe safely across
  multiple instances.
- **`PlacesAutocompleteInput`** (customer-web only): wraps the classic
  `google.maps.places.Autocomplete` widget on a plain `<input>`. Degrades
  to an inert text input (no suggestions) when no API key is configured —
  `useMapsLibrary` returns `null` rather than throwing without an
  `APIProvider` ancestor.
- **Backend additions** (`apps/backend/src/rides/`): `RideTrackingReadService`
  adds two read endpoints consumed by the map UI —
  `GET /customer/rides/nearby-drivers` (anonymized `DriverAvailability`
  positions near a point, coordinates rounded to ~11m for privacy before a
  ride is matched) and `GET /customer/rides/:id/tracking` (the ordered
  `RideTracking` breadcrumb trail for a ride the customer owns, used for
  the Receipt screen's replay). Both were added in the same pass as the
  frontend work since the map UI has no other way to get this data — see
  the commit that landed alongside "MAPS-UI: backend nearby-drivers +
  tracking-history endpoints" for the full design rationale (kept separate
  from `RideDispatchService.findNearestEligibleDriver`, which serves a
  different purpose: single best candidate for dispatch, not a full list
  for map display).
- **Fare/ETA math unchanged**: `RideFareService.estimate` still computes
  fare from straight-line (haversine) distance, same as before this pass —
  the Directions API is used purely for map display (route polyline, ETA
  chip text), not fare calculation. Real road-distance-based pricing is a
  separate, larger change not in scope here.

## Verification

tsc, eslint, vitest/jest, and `next build` all pass clean across
`apps/backend`, `apps/customer-web`, `apps/driver-portal`,
`packages/sdk`, and `packages/types`. Browser verification of the
authenticated map screens (which require a logged-in session and a
running backend) was not done this pass — no backend/database was running
in this environment to seed a test account. Manual QA against a real
deployment is the recommended next check before calling this launch-ready.

## Follow-ups (not blocking, tracked here rather than silently dropped)

- Harden the Maps API key per docs/LAUNCH-READINESS-CREDENTIALS.md before
  launch (currently one broad, unrestricted key).
- Switch to `AdvancedMarker` + a Cloud-based Map ID for richer marker
  styling/animation once that Console resource exists.
- Animate the driver marker's movement between socket updates (currently
  jumps to each new `ride:driver_location` position rather than
  interpolating) — a nice-to-have polish item, not required for the map to
  be functionally real.
- Live in-browser QA against a running backend + seeded rider/driver
  accounts.
