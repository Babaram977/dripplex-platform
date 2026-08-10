# RIDE-003 — Integration Map

**DrippleX Ride Customer UI × Backend**

> **Purpose:** This document is the single source of truth for wiring the approved Figma Ride Customer UI (31 screens, `src/app/rideScreen.tsx`) to the existing DrippleX Ride backend. It defines every API endpoint, WebSocket event, shared hook, state model, and component boundary required for integration. No visual design decisions are made here — the Figma output is the approved spec.
>
> **Rule:** Do not modify any screen layout, color, typography, or animation defined in `rideScreen.tsx`. Replace only mock data, placeholder handlers, and hardcoded strings with live backend calls.

---

## 1. Screen Inventory & Backend Mapping

Every screen in `rideScreen.tsx` is listed below with its navigation key, its data requirements, and the backend endpoint or WebSocket event that satisfies each requirement.

### 1.1 Pre-Ride Screens

"This is the integration map for RIDE-003. Use this as your implementation checklist."

| Screen             | Nav Key        | Data Requirements                              | Backend Source                                                                        |
| ------------------ | -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ride Home          | `ridehome`     | Current user name, saved places, promo balance | `GET /users/me`, `GET /ride/saved-places`                                             |
| Ride Home Extended | `ridehomeplus` | Same + referral stats                          | `GET /ride/referral/stats`                                                            |
| Destination Search | `ridesearch`   | Place autocomplete results                     | `GET /ride/places/autocomplete?q=`                                                    |
| Pickup Confirm     | `ridepickup`   | Resolved coordinates for origin                | Google Maps SDK / `POST /ride/geocode`                                                |
| Fare Estimate      | `ridefare`     | Fare calculation for route                     | `POST /ride/estimate` → `{ base, distance_rate, time_rate, total, surge_multiplier }` |
| Saved Places       | `ridesaved`    | Home, Work, recent places                      | `GET /ride/saved-places`, `POST /ride/saved-places`, `DELETE /ride/saved-places/:id`  |
| Schedule Ride      | `rideschedule` | Fare estimate for future time, surge forecast  | `POST /ride/estimate` with `scheduled_at` param                                       |
| Promo Code         | `ridepromo`    | Available promos, code validation              | `GET /ride/promos`, `POST /ride/promos/apply` → `{ valid, discount, new_total }`      |
| Referral           | `ridereferral` | Referral code, earnings, friend count, rank    | `GET /ride/referral` → `{ code, total_earned, friends_count, weekly_rank }`           |

### 1.2 Matching & En-Route Screens

| Screen                  | Nav Key           | Data Requirements                      | Backend Source                                                   |
| ----------------------- | ----------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Finding Driver          | `ridefinding`     | Real-time trip status + nearby drivers | WS: `trip.searching`, `trip.assigned`                            |
| Driver En Route         | `rideenroute`     | Driver location, ETA, driver profile   | WS: `driver.location`, REST: `GET /ride/trips/:id/driver`        |
| Driver Assigned         | `rideassigned`    | Full driver + vehicle info             | `GET /ride/trips/:id/driver` → `DriverProfile`                   |
| Driver Profile Sheet    | `ridedriver`      | Driver detail, reviews                 | `GET /drivers/:id/profile`                                       |
| Driver Arrived          | `ridearrived`     | Verify code, wait timer start          | WS: `trip.driver_arrived` → `{ verify_code }`                    |
| Driver Arrived Extended | `ridearrivedplus` | Same + wait fee counter                | WS: `trip.waiting_fee_started` → `{ fee_per_min, free_minutes }` |
| Passenger Waiting       | `ridepaxwait`     | Verify code for display                | From `trip.driver_arrived` event payload                         |

### 1.3 Active Ride Screens

| Screen           | Nav Key          | Data Requirements                                | Backend Source                                           |
| ---------------- | ---------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Ride In Progress | `rideinprogress` | Live driver coordinates, ETA, distance remaining | WS: `driver.location` (continuous, ~3s interval)         |
| Live Tracking    | `ridelivetrack`  | Same + shareable link                            | WS: `driver.location`, `GET /ride/trips/:id/share-link`  |
| Share Trip       | `rideshare`      | Share URL, QR payload                            | `GET /ride/trips/:id/share-link` → `{ url, expires_at }` |
| Emergency SOS    | `ridesos`        | Current trip ID, driver info, user location      | From trip state + device GPS                             |

### 1.4 Trip Completion Screens

| Screen          | Nav Key          | Data Requirements                           | Backend Source                                                        |
| --------------- | ---------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Trip Completed  | `ridecomplete`   | Final fare, trip summary                    | WS: `trip.completed` → `TripSummary`                                  |
| Payment         | `ridepayment`    | Payment methods, fare, promo                | `GET /wallet/payment-methods`, from trip state                        |
| OPay Payment    | `rideopay`       | OPay flow initiation                        | `POST /payments/opay/initiate` → `{ session_token }`                  |
| Cash Payment    | `ridecash`       | Trip fare confirmation                      | From trip state only (no API call needed)                             |
| Payment Success | `ridepaysuccess` | Transaction ID, amount, timestamp           | `POST /ride/trips/:id/pay` → `{ txn_id, status }`                     |
| Tip Driver      | `ridetip`        | Driver ID, available tip amounts            | `POST /ride/trips/:id/tip` → `{ amount, driver_id }`                  |
| Rate Driver     | `riderating`     | Stars + tags submission                     | `POST /ride/trips/:id/rating` → `{ stars, tags, comment }`            |
| Trip Receipt    | `ridereceipt`    | Full fare breakdown, payment method, driver | `GET /ride/trips/:id/receipt`                                         |
| Report Trip     | `ridereport`     | Issue categories, trip ID                   | `POST /ride/trips/:id/report` → `{ category, description, photos[] }` |

### 1.5 History Screens

| Screen       | Nav Key       | Data Requirements                   | Backend Source                           |
| ------------ | ------------- | ----------------------------------- | ---------------------------------------- |
| Ride History | `ridehistory` | Paginated trip list, status filters | `GET /ride/trips?page=&status=&limit=20` |
| Ride Detail  | `ridedetail`  | Full single trip                    | `GET /ride/trips/:id`                    |

---

## 2. Ride State Machine

The client-side state machine mirrors the backend trip lifecycle. Every state transition is triggered by a WebSocket event.

```
                    ┌─────────┐
                    │  IDLE   │  (no active trip)
                    └────┬────┘
                         │ POST /ride/trips (book)
                    ┌────▼────────┐
                    │  SEARCHING  │  Finding driver
                    └────┬────────┘
         timeout/cancel  │ trip.assigned
              ┌──────────▼──────────┐
              │  DRIVER_ASSIGNED    │  Driver accepted
              └──────────┬──────────┘
                         │ driver.location (continuous)
              ┌──────────▼──────────┐
              │   DRIVER_EN_ROUTE   │  Driver heading to pickup
              └──────────┬──────────┘
                         │ trip.driver_arrived
              ┌──────────▼──────────┐
              │  DRIVER_ARRIVED     │  Verify code shown
              └──────────┬──────────┘
                         │ trip.started (passenger boarded)
              ┌──────────▼──────────┐
              │    IN_PROGRESS      │  Live tracking active
              └──────────┬──────────┘
                         │ trip.completed
              ┌──────────▼──────────┐
              │     COMPLETED       │  Payment + rating
              └──────────┬──────────┘
                         │ POST /ride/trips/:id/pay
              ┌──────────▼──────────┐
              │      SETTLED        │  Receipt available
              └─────────────────────┘

     CANCELLED ◄─── any state (user/driver/timeout)
```

**TypeScript type:**

```typescript
type RideStatus =
  | 'idle'
  | 'searching'
  | 'driver_assigned'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'settled';

interface ActiveTrip {
  id: string;
  status: RideStatus;
  origin: LatLng;
  destination: LatLng;
  fare_estimate: FareEstimate;
  driver?: DriverProfile;
  verify_code?: string; // present when status = driver_arrived
  share_url?: string; // present when status = in_progress
  waiting_fee_started_at?: number; // epoch ms
  completed_at?: number;
  receipt?: TripReceipt;
}
```

---

## 3. Core Data Types

```typescript
interface LatLng {
  lat: number;
  lng: number;
}

interface PlaceResult {
  place_id: string;
  description: string; // "Victoria Island, Lagos"
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry: { location: LatLng };
}

interface FareEstimate {
  base_fare: number; // ₦800
  distance_km: number; // 14.2
  distance_charge: number; // ₦1,136
  duration_min: number; // 22
  time_charge: number; // ₦154
  subtotal: number;
  surge_multiplier: number; // 1.0 = no surge
  surge_active: boolean;
  promo_discount: number; // 0 if none
  promo_code?: string;
  total: number;
  currency: 'NGN';
}

interface DriverProfile {
  id: string;
  name: string;
  avatar_initials: string; // "AO"
  avatar_url?: string;
  rating: number; // 4.92
  total_trips: number;
  level: 'Standard' | 'Silver' | 'Gold' | 'Platinum';
  verified: boolean;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plate: string;
    photo_url?: string;
  };
  phone: string; // masked for display: "+234 801 *** 5678"
  reviews: DriverReview[];
}

interface DriverReview {
  passenger_name: string; // first name only
  text: string;
  stars: number;
  date: string;
}

interface TripReceipt {
  trip_id: string;
  date: string;
  origin_label: string;
  destination_label: string;
  distance_km: number;
  duration_min: number;
  breakdown: {
    base_fare: number;
    distance_charge: number;
    time_charge: number;
    waiting_charge: number;
    subtotal: number;
    promo_discount: number;
    total: number;
  };
  payment_method: 'wallet' | 'card' | 'cash' | 'opay';
  payment_last4?: string;
  txn_id: string;
  driver: Pick<DriverProfile, 'name' | 'avatar_initials' | 'rating'>;
  pdf_url?: string;
}

interface SavedPlace {
  id: string;
  label: 'Home' | 'Work' | string;
  address: string;
  coordinates: LatLng;
  icon: string; // emoji
}

interface ReferralStats {
  code: string;
  friends_referred: number;
  total_earned_ngn: number;
  weekly_rank: number;
  share_url: string;
}
```

---

## 4. WebSocket Event Schema

All real-time events flow through a single authenticated WebSocket connection established after login.

**Connection:** `wss://api.dripplexapp.com/ws?token=<jwt>`

### Outbound (client → server)

```typescript
// Subscribe to a trip's events
{ type: 'subscribe_trip', trip_id: string }

// Unsubscribe
{ type: 'unsubscribe_trip', trip_id: string }

// Passenger confirms boarding
{ type: 'passenger_boarded', trip_id: string }
```

### Inbound (server → client)

| Event Type                 | Payload                                                       | Triggers UI Transition                         |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `trip.searching`           | `{ trip_id }`                                                 | Show FindingDriverScreen                       |
| `trip.assigned`            | `{ trip_id, driver: DriverProfile, eta_seconds: number }`     | Show DriverAssignedScreen                      |
| `driver.location`          | `{ trip_id, lat, lng, bearing, eta_seconds }`                 | Update map pin continuously                    |
| `trip.driver_arrived`      | `{ trip_id, verify_code: string, free_wait_minutes: number }` | Show DriverArrivedScreen                       |
| `trip.waiting_fee_started` | `{ trip_id, fee_per_min_ngn: number }`                        | Start fee timer in DriverArrivedExtendedScreen |
| `trip.started`             | `{ trip_id, started_at: number }`                             | Show RideInProgressScreen                      |
| `trip.completed`           | `{ trip_id, summary: TripSummary, receipt: TripReceipt }`     | Show TripCompletedScreen                       |
| `trip.cancelled`           | `{ trip_id, reason: string, cancelled_by: 'driver'            | 'system'                                       | 'timeout' }` | Show cancellation dialog |
| `trip.surge_changed`       | `{ trip_id, multiplier: number }`                             | Update fare estimate display                   |
| `payment.success`          | `{ trip_id, txn_id, amount, method }`                         | Show WalletPaySuccessScreen                    |
| `payment.failed`           | `{ trip_id, reason: string }`                                 | Show payment error state                       |

---

## 5. Shared Hooks

These hooks encapsulate all backend interaction. Screens import hooks only — no screen should call `fetch` directly.

### 5.1 `useRide`

**File:** `src/hooks/useRide.ts`

The central hook. Manages the active trip state machine.

```typescript
interface UseRideReturn {
  // State
  trip: ActiveTrip | null;
  status: RideStatus;
  isLoading: boolean;
  error: string | null;

  // Actions
  estimateFare: (origin: LatLng, destination: LatLng, promo?: string) => Promise<FareEstimate>;
  bookRide: (
    origin: LatLng,
    destination: LatLng,
    paymentMethod: PaymentMethod,
    promoCode?: string,
  ) => Promise<void>;
  cancelRide: (tripId: string) => Promise<void>;
  confirmBoarded: (tripId: string) => Promise<void>;
}
```

### 5.2 `useRideTracking`

**File:** `src/hooks/useRideTracking.ts`

Consumes the `driver.location` WebSocket stream. Returns a live-updating driver position.

```typescript
interface UseRideTrackingReturn {
  driverLocation: LatLng | null;
  driverBearing: number; // degrees, for rotating the car icon
  etaSeconds: number | null;
  etaLabel: string; // "8 min"
  distanceRemaining: string; // "4.2 km"
  isConnected: boolean;
}
```

### 5.3 `useRidePayment`

**File:** `src/hooks/useRidePayment.ts`

Handles all payment method selection, promo application, and payment submission.

```typescript
interface UseRidePaymentReturn {
  paymentMethods: PaymentMethod[];
  selectedMethod: PaymentMethod | null;
  promoCode: string;
  promoDiscount: number;
  finalTotal: number;
  isProcessing: boolean;
  setSelectedMethod: (method: PaymentMethod) => void;
  applyPromo: (code: string) => Promise<{ valid: boolean; discount: number; message: string }>;
  removePromo: () => void;
  submitPayment: (tripId: string) => Promise<{ txn_id: string }>;
  initOPay: (tripId: string) => Promise<{ session_token: string }>;
}
```

### 5.4 `useRideDriver`

**File:** `src/hooks/useRideDriver.ts`

Fetches and caches the assigned driver's full profile.

```typescript
interface UseRideDriverReturn {
  driver: DriverProfile | null;
  isLoading: boolean;
  callDriver: () => void; // tel: link
  messageDriver: () => void; // opens in-app chat (future)
  submitRating: (tripId: string, stars: number, tags: string[], comment: string) => Promise<void>;
  submitTip: (tripId: string, amountNgn: number) => Promise<void>;
}
```

### 5.5 `useSavedPlaces`

**File:** `src/hooks/useSavedPlaces.ts`

```typescript
interface UseSavedPlacesReturn {
  places: SavedPlace[];
  recentPlaces: PlaceResult[];
  addPlace: (label: string, address: string, coordinates: LatLng) => Promise<void>;
  updatePlace: (id: string, updates: Partial<SavedPlace>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
}
```

### 5.6 `usePlaceSearch`

**File:** `src/hooks/usePlaceSearch.ts`

Debounced place autocomplete. 300ms debounce, minimum 2 chars.

```typescript
interface UsePlaceSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: PlaceResult[];
  isLoading: boolean;
  selectPlace: (place: PlaceResult) => void;
  selectedPlace: PlaceResult | null;
}
```

### 5.7 `useRideHistory`

**File:** `src/hooks/useRideHistory.ts`

Paginated trip history with infinite scroll support.

```typescript
interface UseRideHistoryReturn {
  trips: TripSummary[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  fetchMore: () => void;
  statusFilter: RideStatus | 'all';
  setStatusFilter: (f: RideStatus | 'all') => void;
  getTrip: (id: string) => Promise<ActiveTrip>;
  getReceipt: (id: string) => Promise<TripReceipt>;
  reportTrip: (id: string, category: string, description: string) => Promise<void>;
}
```

### 5.8 `useRideSchedule`

**File:** `src/hooks/useRideSchedule.ts`

```typescript
interface UseRideScheduleReturn {
  scheduledDate: Date | null;
  setScheduledDate: (d: Date) => void;
  fareEstimate: FareEstimate | null;
  scheduleRide: (origin: LatLng, dest: LatLng, at: Date, method: PaymentMethod) => Promise<void>;
  isLoading: boolean;
}
```

### 5.9 `useShareTrip`

**File:** `src/hooks/useShareTrip.ts`

```typescript
interface UseShareTripReturn {
  shareUrl: string | null;
  qrPayload: string | null;
  isLoading: boolean;
  copyLink: () => Promise<void>;
  copied: boolean;
  shareViaWhatsApp: () => void;
  shareViaSMS: () => void;
}
```

### 5.10 `useReferral`

**File:** `src/hooks/useReferral.ts`

```typescript
interface UseReferralReturn {
  stats: ReferralStats | null;
  isLoading: boolean;
  copyCode: () => Promise<void>;
  copied: boolean;
  shareReferral: () => void;
}
```

---

## 6. REST API Endpoints

All endpoints require `Authorization: Bearer <jwt>` header. Base URL: `https://api.dripplexapp.com/v1`.

### Ride Booking

```
POST   /ride/trips                  Book a ride
GET    /ride/trips/:id              Get single trip
DELETE /ride/trips/:id              Cancel trip
POST   /ride/trips/:id/pay          Submit payment
POST   /ride/trips/:id/rating       Submit driver rating
POST   /ride/trips/:id/tip          Submit tip
POST   /ride/trips/:id/report       Report an issue
GET    /ride/trips/:id/receipt      Get full receipt (PDF url included)
GET    /ride/trips/:id/share-link   Get shareable live-track URL
GET    /ride/trips/:id/driver       Get assigned driver profile
```

### Fare & Pricing

```
POST   /ride/estimate               Calculate fare for route + time
GET    /ride/promos                 List available promos for user
POST   /ride/promos/apply           Validate + apply promo code
```

### Places

```
GET    /ride/places/autocomplete    Place search (q, sessiontoken params)
POST   /ride/geocode                Reverse geocode LatLng → address
GET    /ride/saved-places           List user's saved places
POST   /ride/saved-places           Create saved place
PUT    /ride/saved-places/:id       Update saved place
DELETE /ride/saved-places/:id       Delete saved place
```

### History

```
GET    /ride/trips                  List trips (page, status, limit params)
```

### Referral

```
GET    /ride/referral               Get user's referral stats + code
```

### Schedule

```
POST   /ride/trips                  Same as booking — include `scheduled_at` (ISO 8601)
GET    /ride/trips?status=scheduled List scheduled trips
```

### Payment Methods

```
GET    /wallet/payment-methods      List saved cards + accounts + OPay link status
POST   /payments/opay/initiate      Start OPay PIN flow → { session_token }
POST   /payments/opay/verify        Complete OPay flow
```

---

## 7. Route Structure (Component Hierarchy)

The integration target is the existing single-router pattern in `App.tsx`. No routing library is introduced — the flat `Screen` type union and `go(screen)` function are preserved.

```
App.tsx
 └── RideModule (all ride screens share these providers)
      ├── RideProvider              (useRide state + WebSocket)
      │    ├── ActiveTripContext
      │    └── WebSocketContext
      ├── RideHomeScreen            ← useSavedPlaces, useReferral
      ├── RideHomeExtendedScreen    ← useSavedPlaces, useReferral
      ├── DestinationSearchScreen   ← usePlaceSearch
      ├── PickupConfirmScreen       ← static (coords from search result)
      ├── FareEstimateScreen        ← useRide.estimateFare
      ├── PaymentScreen             ← useRidePayment
      ├── OPayPaymentScreen         ← useRidePayment.initOPay
      ├── CashPaymentScreen         ← static
      ├── PromoCodeScreen           ← useRidePayment.applyPromo
      ├── FindingDriverScreen       ← useRide (status=searching) + WS
      ├── DriverEnRouteScreen       ← useRideTracking + useRideDriver
      ├── DriverAssignedScreen      ← useRideDriver
      ├── DriverProfileSheet        ← useRideDriver
      ├── DriverArrivedScreen       ← useRide (verify_code)
      ├── DriverArrivedExtendedScreen ← useRide (waiting_fee)
      ├── PassengerWaitingScreen    ← useRide (verify_code)
      ├── RideInProgressScreen      ← useRideTracking
      ├── LiveTrackingScreen        ← useRideTracking + useShareTrip
      ├── ShareTripScreen           ← useShareTrip
      ├── EmergencySOSScreen        ← static + device GPS
      ├── TripCompletedScreen       ← useRide (completed summary)
      ├── TipDriverScreen           ← useRideDriver.submitTip
      ├── RateDriverScreen          ← useRideDriver.submitRating
      ├── WalletPaySuccessScreen    ← useRidePayment (txn result)
      ├── TripReceiptScreen         ← useRideHistory.getReceipt
      ├── ReportTripScreen          ← useRideHistory.reportTrip
      ├── RideHistoryScreen         ← useRideHistory
      ├── RideDetailScreen          ← useRideHistory.getTrip
      ├── SavedPlacesScreen         ← useSavedPlaces
      ├── ScheduleRideScreen        ← useRideSchedule
      └── ReferralScreen            ← useReferral
```

---

## 8. Map Integration

The current `MapCanvas` in `rideScreen.tsx` is a pure SVG placeholder. For production it must be replaced with a real map SDK while preserving the visual container dimensions.

**Recommended:** Google Maps JavaScript API (matches the existing Google Maps REST integration mentioned in the Ops Console settings).

**Replacement plan:**

- `MapCanvas` component signature stays identical: `({ variant, progress })`
- Internal implementation switches from SVG to Google Maps `<Map>` component
- The surrounding layout (bottom sheet overlay, ETA bubble, gradient fade) remains unchanged
- Driver pin animated movement: interpolate between `driver.location` WebSocket events using `requestAnimationFrame`
- Route polyline: decoded from `POST /ride/estimate` → `polyline` field (Google encoded polyline format)

**Map state per screen:**

| Screen           | Map Behavior                                                     |
| ---------------- | ---------------------------------------------------------------- |
| Pickup Confirm   | Static, user draggable pickup pin                                |
| Finding Driver   | Animated nearby driver dots, searching pulse ring                |
| Driver En Route  | Driver pin animates toward pickup; route from driver → pickup    |
| Ride In Progress | Driver pin animates toward destination; route from pickup → dest |
| Live Tracking    | Same as In Progress + share button overlay                       |
| Trip Completed   | Static, no animation, greyed route                               |

---

## 9. Backend Capability Gaps

The following UI requirements have no confirmed backend endpoint. These must be verified with the backend team before implementation — **do not create workarounds**.

| UI Requirement                  | Screen                       | Gap                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPay PIN pad flow               | `rideopay`                   | Confirm `POST /payments/opay/initiate` returns a `session_token` that the frontend can pass to OPay's JS SDK, or if the backend handles the full PIN verification server-side                       |
| Driver phone call               | `rideassigned`, `ridedriver` | Confirm whether the backend returns a real phone number or a masked proxy number (TelerivetTNG or Twilio number). The UI shows a call button — it must dial a real number                           |
| Live trip share public endpoint | `rideshare`                  | `/ride/trips/:id/share-link` must return a URL accessible without authentication (public viewer page). Confirm this exists                                                                          |
| Surge notifications             | All fare screens             | Confirm `trip.surge_changed` WS event is emitted when surge multiplier changes mid-search                                                                                                           |
| Scheduled ride management       | `rideschedule`               | Confirm `GET /ride/trips?status=scheduled` and `DELETE /ride/trips/:id` work for pre-booked trips                                                                                                   |
| Driver photo URL                | `ridedriver`, `rideassigned` | Confirm `DriverProfile.avatar_url` is populated (the UI shows initials as a fallback, but a real photo is preferred)                                                                                |
| Report photo upload             | `ridereport`                 | The UI has a photo attach button — confirm `POST /ride/trips/:id/report` accepts `multipart/form-data`                                                                                              |
| SOS alert API                   | `ridesos`                    | The SOS screen currently only triggers `tel:` for emergency services. Confirm whether there is a `POST /ride/trips/:id/sos` endpoint that notifies the operations team and shares the live location |
| Receipt PDF                     | `ridereceipt`                | Confirm `GET /ride/trips/:id/receipt` returns a `pdf_url` field for the download button                                                                                                             |

---

## 10. Implementation Checklist

Use this as the PR checklist for RIDE-003. Each item should be a separate commit.

### Foundation (no visual changes)

- [ ] Create `src/hooks/useRide.ts` with WebSocket subscription
- [ ] Create `src/hooks/useRideTracking.ts`
- [ ] Create `src/hooks/useRidePayment.ts`
- [ ] Create `src/hooks/useRideDriver.ts`
- [ ] Create `src/hooks/useSavedPlaces.ts`
- [ ] Create `src/hooks/usePlaceSearch.ts`
- [ ] Create `src/hooks/useRideHistory.ts`
- [ ] Create `src/hooks/useRideSchedule.ts`
- [ ] Create `src/hooks/useShareTrip.ts`
- [ ] Create `src/hooks/useReferral.ts`
- [ ] Create `src/context/RideProvider.tsx`
- [ ] Wrap ride screens in `RideProvider` in `App.tsx`
- [ ] Resolve all backend capability gaps (Section 9)

### Screen Integration (preserve all layouts)

- [ ] DestinationSearchScreen — live place autocomplete
- [ ] FareEstimateScreen — live fare from API
- [ ] PaymentScreen — live payment methods
- [ ] FindingDriverScreen — WebSocket `trip.assigned` transition
- [ ] DriverEnRouteScreen — live driver location on map
- [ ] DriverArrivedScreen — verify code from WS event
- [ ] RideInProgressScreen — live tracking on map
- [ ] LiveTrackingScreen — same + share URL
- [ ] TripCompletedScreen — data from WS `trip.completed`
- [ ] PaymentScreen → OPayPaymentScreen → WalletPaySuccessScreen
- [ ] TipDriverScreen — real submission
- [ ] RateDriverScreen — real submission
- [ ] TripReceiptScreen — real receipt data + PDF link
- [ ] ReportTripScreen — real submission
- [ ] RideHistoryScreen — paginated real data
- [ ] SavedPlacesScreen — CRUD against API
- [ ] ScheduleRideScreen — real booking with `scheduled_at`
- [ ] PromoCodeScreen — real validation
- [ ] ReferralScreen — real stats + share
- [ ] EmergencySOSScreen — SOS endpoint + tel: link
- [ ] ShareTripScreen — real share URL + QR

### Map replacement

- [ ] Replace `MapCanvas` SVG with Google Maps SDK
- [ ] Animate driver pin using WS `driver.location` events
- [ ] Render encoded polyline route from fare estimate

### Testing

- [ ] Unit tests for all hooks (mock WS + REST)
- [ ] E2E: full booking flow (search → book → assigned → arrived → in-progress → complete → pay → rate)
- [ ] E2E: cancellation flow
- [ ] E2E: OPay payment path
- [ ] E2E: promo code application
- [ ] Manual: SOS screen on device

---

## 11. Design Constraints (Do Not Modify)

The following are locked by the approved Figma design. No implementation decision may alter them:

- All color values — use only tokens from `src/tokens/colors.ts`
- All font families — Poppins (headings/prices) + Inter (body)
- All border radius values — `rounded-2xl` (16px) for cards, `rounded-full` for chips
- All animation timing — 220ms fade+scale for screen transitions
- Bottom sheet peek height — ~260px for ride screens
- Phone frame dimensions — 390×844px (do not add scrollbars to frames)
- Navigation pattern — flat `Screen` union + `go()` function (no router library)
- The `GreenButton`, `BackArrow`, `BottomSheet`, `MapCanvas`, `RideStatusBar`, `SafetyChip`, `StarRow` sub-components — replace internals only, never the outer API

---

_Last updated: RIDE-003 pre-integration · Figma Make design preview_
