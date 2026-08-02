# Launch Readiness — Phase 1: Production Credentials

Tracks the external-integration checklist from the founder's Launch
Readiness Phase (post Driver Portal MVP — see docs/DRIVER-PORTAL-SLICE-5.md).
One section per integration; update the status line as each moves from
wired to hardened to verified live.

## Google Maps

**Status: wired end-to-end (backend + frontend UI), unrestricted key, not yet hardened.**

- Backend: `GOOGLE_MAPS_SERVER_API_KEY` → `GoogleReverseGeocoder`
  (`apps/backend/src/addresses/geocoding/google-reverse-geocoder.ts`),
  bound in via `AddressesModule`'s factory provider whenever the key is
  set (falls back to `NotConfiguredReverseGeocoder` otherwise — see
  `AppConfigService.googleMapsConfigured`). Verified live against the
  Geocoding API and Places API on 2026-08-02. Two new read endpoints,
  `GET /customer/rides/nearby-drivers` and `GET /customer/rides/:id/tracking`
  (`RideTrackingReadService`), feed the map UI below.
- Frontend: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` consumed by a real Google
  Maps JavaScript API integration in both customer-web and driver-portal —
  `MapCanvas` is no longer the only option; see docs/MAPS-UI.md for the
  full breakdown of what was built. Falls back to the original decorative
  `MapCanvas` SVG in any environment without the key configured.
- **Outstanding before launch:**
  1. The current key ("Maps Platform API Key" in Google Cloud Console) is
     **unrestricted** — no HTTP referrer restriction, no API restriction
     (broad access across ~35 enabled APIs, most unrelated to Maps). It
     was used as-is to unblock development quickly. Before launch: split
     into two properly restricted keys —
     - Browser key: Application restriction = Websites (real prod domains
       and localhost), API restriction = Maps JavaScript API + Places API
       - Directions API.
     - Server key: Application restriction = IP addresses (backend's
       deploy IP once Coolify is live), API restriction = Geocoding API.
  2. Two other keys already exist in the same GCP project
     (`dripplex-web-browser-key`, `dripplex-backend-server-key`) but are
     misconfigured — restricted to **Time Zone API** by accident during
     setup, not the Maps APIs actually needed. Either fix their
     restrictions and swap them in, or delete them to avoid confusion.
  3. Set a budget alert on the Google Cloud billing account (Maps
     Platform gives ~$200/month free credit, but nothing stops overage
     without an alert — Directions API calls now happen on nearly every
     ride-flow screen transition, so usage volume is meaningfully higher
     than the reverse-geocoding-only baseline this doc originally tracked).
  4. Add a Cloud-based Map ID and switch `Marker` to `AdvancedMarker` for
     richer marker styling/collision handling — not required for launch,
     current classic `Marker` usage needs no Map ID.

## Paystack

Not started this pass.

## Firebase

Web push config for customer-web is real (see root `.env.example`);
backend Admin SDK credentials (`FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/
`PRIVATE_KEY`) status not re-verified this pass — confirm still valid.

## Termii

Not started — no `TERMII_*` env vars exist anywhere in
`env.validation.ts` yet. SMS is currently not wired to any real provider.

## Coolify deployment / Domain SSL / Monitoring

Not started this pass.
