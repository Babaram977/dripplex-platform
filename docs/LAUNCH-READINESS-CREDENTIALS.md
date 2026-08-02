# Launch Readiness — Phase 1: Production Credentials

Tracks the external-integration checklist from the founder's Launch
Readiness Phase (post Driver Portal MVP — see docs/DRIVER-PORTAL-SLICE-5.md).
One section per integration; update the status line as each moves from
wired to hardened to verified live.

## Google Maps

**Status: wired, unrestricted, not yet hardened.**

- Backend: `GOOGLE_MAPS_SERVER_API_KEY` → `GoogleReverseGeocoder`
  (`apps/backend/src/addresses/geocoding/google-reverse-geocoder.ts`),
  bound in via `AddressesModule`'s factory provider whenever the key is
  set (falls back to `NotConfiguredReverseGeocoder` otherwise — see
  `AppConfigService.googleMapsConfigured`). Verified live against the
  Geocoding API and Places API on 2026-08-02.
- Frontend: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` added to customer-web and
  driver-portal `.env.example`. **Not yet consumed by any UI** — `MapCanvas`
  in both apps is still the decorative SVG placeholder documented in
  docs/DRIVER-PORTAL-SLICE-3.md. Swapping it for a real Google Maps
  JavaScript API + Places Autocomplete component is a separate, larger
  follow-up, not done as part of this credential-wiring pass.
- **Outstanding before launch:**
  1. The current key ("Maps Platform API Key" in Google Cloud Console) is
     **unrestricted** — no HTTP referrer restriction, no API restriction
     (broad access across ~35 enabled APIs, most unrelated to Maps). It
     was used as-is to unblock development quickly. Before launch: split
     into two properly restricted keys —
     - Browser key: Application restriction = Websites (real prod domains
       - localhost), API restriction = Maps JavaScript API + Places API.
     - Server key: Application restriction = IP addresses (backend's
       deploy IP once Coolify is live), API restriction = Geocoding API.
  2. Two other keys already exist in the same GCP project
     (`dripplex-web-browser-key`, `dripplex-backend-server-key`) but are
     misconfigured — restricted to **Time Zone API** by accident during
     setup, not the Maps APIs actually needed. Either fix their
     restrictions and swap them in, or delete them to avoid confusion.
  3. Set a budget alert on the Google Cloud billing account (Maps
     Platform gives ~$200/month free credit, but nothing stops overage
     without an alert).
  4. Build the real map UI (frontend work, not done yet).

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
