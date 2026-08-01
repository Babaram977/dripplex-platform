# RIDE-003 — Integration Map

**Status: foundation only. The Figma Ride Customer file is not yet connected to this
session** (Figma is authenticated at the workspace level but toggled off for this
chat, and no file link has been shared). Nothing in this document describes a visual
layout, and no screen component has been written. Everything below is verified against
the actual backend code (controllers, DTOs, Prisma schema, WebSocket gateway) — nothing
is guessed. Where a capability doesn't exist, it's listed in Section 6 as a gap, not
assumed or worked around.

The founder's own screen list from the RIDE-003 kickoff (Splash, Login, Ride Home,
Search, Ride Options, Driver Searching, Driver Assigned, Driver En Route, Driver
Arrived, Passenger Waiting, Live Tracking, Ride In Progress, Payment, Wallet, Card,
Cash, OPay, Payment Success, Receipt, Rating, Tip Driver, Report Trip, Saved Places,
Schedule Ride, Promo, Referral, Ride History — 26 named screens) is used as the
provisional screen list below. A later message referenced "31 screens" and specific
section numbers for this document; that count and structure have not been verified
against an actual connected Figma file in this session, so Section 1 is built from the
named list above, not a number I can't confirm. **Screen names, exact count, navigation
flow, and layout are Figma's job once connected — this document only says what backend
capability each named screen needs, and whether that capability exists today.**

## 1. Screen → backend capability

| #   | Screen (as named in the RIDE-003 kickoff)         | Backend capability                                                                                                                                                                                  | Exists?                                                                                                          |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Splash                                            | none (client-side only)                                                                                                                                                                             | n/a                                                                                                              |
| 2   | Login                                             | `POST /auth/login` (existing, pre-Ride)                                                                                                                                                             | ✅ existing                                                                                                      |
| 3   | Ride Home                                         | `sdk.rides.listRides()` for "recent/active ride" banner, `sdk.addresses.list()` for saved places                                                                                                    | ✅ existing                                                                                                      |
| 4   | Search (pickup/dropoff picker)                    | none — this is a maps/geocoding UI concern, not a Ride backend call                                                                                                                                 | n/a (see Section 6, no server-side geocoding proxy)                                                              |
| 5   | Ride Options (choose Economy/Tricycle, see price) | **no fare-quote endpoint** — the only way to get a fare is `sdk.rides.requestRide()`, which computes _and creates_ the ride atomically                                                              | ❌ gap — see Section 6                                                                                           |
| 6   | Driver Searching                                  | `ride:status` WS event (status stays `SEARCHING`)                                                                                                                                                   | ✅ existing                                                                                                      |
| 7   | Driver Assigned                                   | `ride:status` WS event (`status: DRIVER_ASSIGNED`)                                                                                                                                                  | ✅ existing, **but no driver identity payload** — see Section 6                                                  |
| 8   | Driver En Route                                   | no distinct backend state — UI-only interpretation of `DRIVER_ASSIGNED` + `ride:driver_location` WS updates                                                                                         | ⚠️ derived, not a backend status                                                                                 |
| 9   | Driver Arrived                                    | `ride:status` WS event (`status: ARRIVED`)                                                                                                                                                          | ✅ existing                                                                                                      |
| 10  | Passenger Waiting                                 | same as Driver Arrived — UI framing, not a new backend state                                                                                                                                        | ⚠️ derived                                                                                                       |
| 11  | Live Tracking                                     | `ride:driver_location` WS event, `RideTracking` history via... **no customer-facing tracking-history endpoint exists** (RideTracking rows are written by the gateway but never read back over REST) | ⚠️ live location works via WS; historical polyline does not                                                      |
| 12  | Ride In Progress                                  | `ride:status` WS event (`status: IN_PROGRESS`)                                                                                                                                                      | ✅ existing                                                                                                      |
| 13  | Payment (method picker)                           | `sdk.rides.initiatePayment()`                                                                                                                                                                       | ✅ existing                                                                                                      |
| 14  | Wallet (pay with wallet)                          | `initiatePayment(method: 'WALLET')`, `sdk.wallet.customerWallet()` for balance display                                                                                                              | ✅ existing                                                                                                      |
| 15  | Card                                              | `initiatePayment(method: 'PAYSTACK'\|'FLUTTERWAVE')` → real gateway redirect via `authorizationUrl`                                                                                                 | ✅ existing (Paystack/Flutterwave are real, configured providers)                                                |
| 16  | Cash                                              | `initiatePayment(method: 'CASH')` (customer side); driver-side confirmation is a separate driver-portal concern                                                                                     | ✅ existing                                                                                                      |
| 17  | OPay                                              | `initiatePayment(method: 'OPAY')`                                                                                                                                                                   | ⚠️ registered but **stubbed** — throws `NotImplementedException`, no real OPay credentials exist. See Section 6. |
| 18  | Payment Success                                   | `verifyPayment()` response / `ride:payment` WS event                                                                                                                                                | ✅ existing                                                                                                      |
| 19  | Receipt                                           | `sdk.rides.getReceipt()`                                                                                                                                                                            | ✅ existing (only after `COMPLETED`)                                                                             |
| 20  | Rating                                            | `sdk.rides.rateDriver()`                                                                                                                                                                            | ✅ existing                                                                                                      |
| 21  | Tip Driver                                        | `sdk.rides.tipDriver()`                                                                                                                                                                             | ✅ existing                                                                                                      |
| 22  | Report Trip                                       | `sdk.rides.reportProblem()`                                                                                                                                                                         | ✅ existing, **text only — no photo attachment field**                                                           |
| 23  | Saved Places                                      | `sdk.addresses.*` (full CRUD, pre-existing, not Ride-specific)                                                                                                                                      | ✅ existing                                                                                                      |
| 24  | Schedule Ride                                     | none — `Ride` has no `scheduledAt` field, `RequestRideDto` has no future-time field                                                                                                                 | ❌ gap — see Section 6                                                                                           |
| 25  | Promo                                             | none — no promo/discount field on `Ride`; the platform's general `Promotion` engine was built for marketplace orders/cart, never wired to ride fares                                                | ❌ gap — see Section 6                                                                                           |
| 26  | Referral                                          | none — no referral model, endpoint, or field anywhere in the backend                                                                                                                                | ❌ gap — see Section 6                                                                                           |
| —   | Ride History                                      | `sdk.rides.listRides()` (paginated, filterable by status)                                                                                                                                           | ✅ existing                                                                                                      |

## 2. State model

There is no single backend "trip lifecycle" enum that spans idle→settled. There are two
independent backend fields that the frontend must compose:

```ts
// Directly from the backend Prisma enum (packages/types/src/ride/index.ts RideStatus) — do not rename these.
type RideStatus =
  | 'REQUESTED' // created, dispatch not yet run (transient — requestRide dispatches synchronously)
  | 'SEARCHING' // dispatch is offering drivers
  | 'DRIVER_ASSIGNED' // a driver accepted; covers both "assigned" and "en route" from a UX standpoint
  | 'ARRIVED' // driver marked arrived
  | 'IN_PROGRESS' // trip started (GPS-proximity gated, RIDE-002.10)
  | 'COMPLETED' // trip finished — payment/tip/rating/receipt only become available now
  | 'CANCELLED'
  | 'NO_DRIVERS_FOUND'; // terminal, dispatch exhausted every eligible driver

type RidePaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
```

The UI-facing composite state a `useRide` consumer actually wants (idle before any ride
exists locally, then driven by `RideStatus`, with payment layered on top of
`COMPLETED`):

```ts
// apps/customer-web — UI composite, NOT a backend contract. Derived, documented here
// so every screen computes it the same way instead of re-inventing it.
export type RideUiState =
  | { phase: 'idle' }
  | { phase: 'searching'; ride: RideDto }
  | { phase: 'assigned'; ride: RideDto } // RideStatus.DRIVER_ASSIGNED
  | { phase: 'arrived'; ride: RideDto } // RideStatus.ARRIVED
  | { phase: 'in_progress'; ride: RideDto } // RideStatus.IN_PROGRESS
  | { phase: 'awaiting_payment'; ride: RideDto } // COMPLETED, paymentStatus !== 'PAID'
  | { phase: 'settled'; ride: RideDto } // COMPLETED, paymentStatus === 'PAID'
  | { phase: 'cancelled'; ride: RideDto }
  | { phase: 'no_drivers_found'; ride: RideDto };

export function toRideUiState(ride: RideDto | null): RideUiState {
  if (!ride) return { phase: 'idle' };
  switch (ride.status) {
    case 'SEARCHING':
    case 'REQUESTED':
      return { phase: 'searching', ride };
    case 'DRIVER_ASSIGNED':
      return { phase: 'assigned', ride };
    case 'ARRIVED':
      return { phase: 'arrived', ride };
    case 'IN_PROGRESS':
      return { phase: 'in_progress', ride };
    case 'COMPLETED':
      return ride.paymentStatus === 'PAID'
        ? { phase: 'settled', ride }
        : { phase: 'awaiting_payment', ride };
    case 'CANCELLED':
      return { phase: 'cancelled', ride };
    case 'NO_DRIVERS_FOUND':
      return { phase: 'no_drivers_found', ride };
  }
}
```

There is deliberately no `driver_en_route` backend status and no `settled` backend
status — both are UI interpretations layered on real fields, implemented as
`toRideUiState` above (built in `apps/customer-web/src/hooks/rides/ride-ui-state.ts`),
not invented backend contracts.

## 3. Core data types

These are the actual shapes the SDK returns today (from `@dripplex/types`) — not
proposed types, existing ones:

- **`RideDto`** — the ride itself (fare breakdown, status, payment status/method,
  pickup/dropoff, timestamps). `driverId` only — **no embedded driver name/phone/
  vehicle**, see Section 6.
- **`RideReceiptDto`** — post-completion only. Includes `driver: { id, name, phone,
vehicleType } | null`, full fare breakdown incl. tip/commission/earning,
  payment method/status.
- **`RideRatingDto`**, **`RideProblemReportDto`** — as built in RIDE-002.8.
- **`WalletDto`** (from `sdk.wallet.customerWallet()`) — balance for the Wallet payment
  screen.
- **`CustomerAddressDto`** (from `sdk.addresses.*`) — reused as-is for Saved Places.

Types that were named in a later message (`ActiveTrip`, `DriverProfile`,
`FareEstimate`, `TripReceipt`, `SavedPlace`, `ReferralStats`) don't correspond to real
backend response shapes under those names. Where they map to something real, the actual
type is listed above; where they don't (`FareEstimate`, live `DriverProfile`,
`ReferralStats`), that's a capability gap in Section 6, not a naming difference.

## 4. WebSocket schema (`RideGateway`, namespace `/rides`)

Verified directly from `apps/backend/src/rides/ride.gateway.ts`. Auth: connect with
`{ auth: { token: accessToken } }` (or an `Authorization: Bearer` header) — same JWT
access token the REST client uses. Reconnect and re-`ride:join` whenever the token
rotates.

**Client → server:**

| Event             | Payload                                   | Notes                                                                                                                             |
| ----------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ride:join`       | `{ rideId: string }`                      | Required before any `ride:*` events for that ride will be delivered. Server verifies the caller is the ride's customer or driver. |
| `ride:leave`      | `{ rideId: string }`                      |                                                                                                                                   |
| `driver:location` | `{ latitude: number; longitude: number }` | **Driver-only** — the passenger app never emits this.                                                                             |

**Server → client** (all scoped to the `ride:{id}` room the client joined):

| Event                  | Payload                               | Fired on                                                                           |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `ride:status`          | `{ rideId, status, driverId }`        | every trip-lifecycle transition (assigned, arrived, started, completed, cancelled) |
| `ride:payment`         | `{ rideId, paymentStatus, method }`   | payment success                                                                    |
| `ride:driver_location` | `{ rideId, latitude, longitude, at }` | throttled to one update per 5s per driver (`RIDE_LOCATION_THROTTLE_MS`)            |

**Server → driver room only** (not relevant to the customer app, listed for
completeness): `ride:offered` on `driver:{driverId}`.

**Not yet resolved — base URL derivation.** The gateway has no REST path prefix; it's a
Socket.IO namespace on the same Nest process. `useRideTracking` derives the socket URL
by stripping any trailing `/api/...` path off `NEXT_PUBLIC_API_BASE_URL` and appending
`/rides`. This is a reasonable inference from the code, **not verified against the
actual Railway/Cloudflare deployment topology** — needs a real connectivity check once
RIDE-003 gets to Slice 2 (see Section 7), in case the WS gateway sits behind a different
host or needs sticky sessions.

## 5. Shared hooks

Built in `apps/customer-web/src/hooks/rides/`, consuming `sdk` from
`apps/customer-web/src/lib/sdk.ts` exclusively (enforced by the existing
`sdk-isolation.spec.ts` test — no direct `@dripplex/sdk` HTTP imports from hooks or
screens).

| Hook                                                  | Backing capability                                                  | Status                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `useRide(rideId)`                                     | `GET /customer/rides/:id`, polls only as a WS fallback              | ✅ built                                                                                               |
| `useRideList(query)`                                  | `GET /customer/rides`                                               | ✅ built                                                                                               |
| `useRequestRide()`                                    | `POST /customer/rides`                                              | ✅ built                                                                                               |
| `useCancelRide()`                                     | `POST /customer/rides/:id/cancel`                                   | ✅ built                                                                                               |
| `useRideTracking(rideId)`                             | WebSocket: joins `ride:{id}`, exposes live status + driver location | ✅ built                                                                                               |
| `useInitiateRidePayment()` / `useVerifyRidePayment()` | `POST .../pay`, `POST .../pay/verify`                               | ✅ built                                                                                               |
| `useTipDriver()`                                      | `POST .../tip`                                                      | ✅ built                                                                                               |
| `useRideReceipt(rideId)`                              | `GET .../receipt`                                                   | ✅ built                                                                                               |
| `useRateDriver()`                                     | `POST .../rate-driver`                                              | ✅ built                                                                                               |
| `useReportRideProblem()`                              | `POST .../report`                                                   | ✅ built                                                                                               |
| `useCustomerWallet()`                                 | `GET /customer/wallet`                                              | ✅ built (thin wrapper, not Ride-specific)                                                             |
| `useSavedPlaces()`                                    | `sdk.addresses.*`                                                   | ✅ built (thin wrapper, not Ride-specific — reused as-is per the founder's "no duplicated logic" rule) |
| `useRideDriver(rideId)`                               | none                                                                | ❌ **blocked** — no endpoint returns driver identity for a non-completed ride (Section 6)              |
| `useRideSchedule()`                                   | none                                                                | ❌ **blocked** — no scheduling field exists (Section 6)                                                |
| `useShareTrip(rideId)`                                | none                                                                | ❌ **blocked** — no public share-link capability exists (Section 6)                                    |
| `useReferral()`                                       | none                                                                | ❌ **blocked** — no referral system exists anywhere in the backend (Section 6)                         |
| `usePlaceSearch()`                                    | none (client-side maps concern)                                     | n/a — this is a Google Places Autocomplete integration, not a Ride backend call                        |

The four blocked hooks are **not** stubbed with fake data or workarounds. They don't
exist as files yet — building them against nothing would be exactly the kind of
guessing this phase is meant to avoid. Their intended signature is documented here so
implementing them later (once the backend gap is closed) doesn't require re-deriving
the contract.

## 6. Capability gaps (verified absent, not worked around)

1. **No fare-quote/estimate endpoint.** `RideFareService.estimate()` is only ever
   called inside `RidesService.requestRide()`, which creates the ride as a side effect.
   There's no way to show "Economy: ₦850 · Tricycle: ₦520" before the customer commits.
   Blocks: Ride Options screen showing real prices before request.
2. **No driver identity during an active ride.** `RideDto` carries `driverId` only.
   Driver name/phone/vehicle type exist in the backend (`User`, `DriverAvailability`)
   and are already assembled by `RideReceiptService` — but only for `COMPLETED` rides.
   Blocks: Driver Assigned / En Route / Arrived screens showing who's coming.
3. **OPay is a stub.** Registered, follows the `MoniepointProvider` precedent, throws
   `NotImplementedException` on every call. No real merchant credentials exist.
   Blocks: OPay actually completing a payment (documented since RIDE-002.7).
4. **No scheduled-ride capability.** No `scheduledAt` field on `Ride`, no future-
   dispatch mechanism. Blocks: Schedule Ride screen.
5. **No ride-level promo/discount application.** The general `Promotion` engine exists
   for marketplace orders but was never wired to `RideFareService` or `Ride`. Blocks:
   Promo screen actually reducing a fare.
6. **No referral system.** No model, endpoint, or field anywhere. Blocks: Referral
   screen entirely.
7. **No public trip-sharing link.** No share-token model, no unauthenticated
   read-only tracking endpoint. Blocks: any "share my trip" affordance.
8. **No SOS/emergency capability.** Already flagged in RIDE-002.9 and RIDE-002.10 —
   still open, still a founder decision on timing, not built.
9. **Report Trip is text-only.** `ReportRideProblemDto` has `category` + text
   `description`, no photo/attachment field. Blocks: photo upload on the Report screen.
10. **No customer-facing tracking-history/polyline endpoint.** `RideTracking` rows are
    written by the gateway on every location update but never read back over REST —
    live location works via `ride:driver_location`, but there's no way to fetch "the
    route so far" if a screen mounts mid-trip and needs to backfill the polyline.
11. **No masked/proxy calling.** `RideReceiptDto.driver.phone` is the driver's real
    number — there's no telephony-proxy layer. Not necessarily a blocker (many
    ride-hailing apps show the real number), but worth a product decision if the design
    assumes masked calling.
12. **No receipt PDF/export.** `RideReceiptDto` is a JSON read model; there's no
    PDF-generation or download endpoint.

None of these are being worked around. Per the founder's instruction, if a named
screen depends on one of these, that screen ships without the dependent feature (or is
deferred) and the gap stays visible here — it does not get a client-side fake.

## 7. Proposed execution order (once Figma is connected)

Four verified vertical slices, each ending in a browser walkthrough before the next
starts — not all 26+ screens at once:

- **Slice 1 — Ride Request**: Splash, Login, Ride Home, Search, Ride Options.
  Blocked in part by gap #1 (no fare quote) — Ride Options may need to show fare only
  after a provisional request, or the gap needs a founder/product call before this
  slice is "done."
- **Slice 2 — Active Ride**: Searching, Driver Assigned, En Route, Arrived, Live
  Tracking, In Progress. Blocked in part by gap #2 (no driver identity) and gap #11
  (base-URL derivation needs a real connectivity check).
- **Slice 3 — Completion**: Payment, Wallet, Card, Cash, OPay, Payment Success,
  Receipt. OPay ships as "not available yet" per gap #3.
- **Slice 4 — Post Ride**: Rating, Tip, Report, History, Saved Places, Schedule, Promo,
  Referral. Schedule/Promo/Referral ship deferred per gaps #4/#5/#6.

## 8. What must not change (design constraints, carried forward for whenever Figma

connects)

Per the founder's locked rules for RIDE-003: colors, typography, spacing, animation
timing, navigation pattern, and component/sub-component APIs are Figma's job, not
implementation's to invent or adjust. This document defines _data_, not _pixels_ — no
visual decision has been made here, and none should be inferred from it.
