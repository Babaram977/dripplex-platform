# RIDE-001B — Ride Architecture Specification

**Date:** 2026-08-01
**Status:** Locked pending founder review. No code has been written against this spec yet — per the founder's explicit instruction, product decisions are locked before RIDE-002 implementation begins.
**Builds on:** `docs/RIDE-001A-BACKEND-AUDIT.md` (what exists), `docs/FIGMA-SOURCE-INVENTORY.md` (confirms no Ride UI reference exists yet).

## 1. Locked product decisions

| Decision                          | Answer                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| Ride types (Kano beta)            | **Economy + Tricycle (Keke)**                                   |
| Fare model                        | **Base fare + distance + time** (no surge for pilot)            |
| Driver onboarding, mandatory docs | **License + vehicle papers + National ID** (insurance deferred) |
| Real-time architecture            | **WebSockets**                                                  |

Everything below is designed around these four answers. Changing any of them later is possible but would touch the schema, dispatch matching, or the WebSocket gateway respectively — flagging that cost now so it's visible if reopened.

## 2. Data model — siblings to `delivery`, not extensions of it

Per the audit's recommendation: `Ride` is a new domain next to `delivery`, not a generalization of `DeliveryJob`. A ride isn't a delivery — forcing one schema to cover both would mean nullable fields on both sides forever (a delivery has no "passenger," a ride has no "proof of delivery photo").

### New enums

```prisma
enum RideType {
  ECONOMY
  TRICYCLE
}

enum RideStatus {
  REQUESTED       // customer submitted, matching not yet started
  SEARCHING       // actively offering to candidate drivers
  DRIVER_ASSIGNED // a driver accepted, en route to pickup
  ARRIVED         // driver at pickup point
  IN_PROGRESS     // trip started, en route to dropoff
  COMPLETED
  CANCELLED
  NO_DRIVERS_FOUND
}

enum RideCancelledBy {
  CUSTOMER
  DRIVER
  SYSTEM
}
```

`KycDocumentType` gets one new value, `VEHICLE_REGISTRATION` — `NATIONAL_ID` and `DRIVER_LICENSE` already exist and are reused as-is, following the exact pattern `MerchantKyc` already established.

### New models

```prisma
model Ride {
  id                       String           @id @default(uuid()) @db.Uuid
  customerId               String           @map("customer_id") @db.Uuid
  driverId                 String?          @map("driver_id") @db.Uuid
  rideType                 RideType         @map("ride_type")
  status                   RideStatus       @default(REQUESTED)
  pickupLatitude            Decimal          @db.Decimal(10, 7)
  pickupLongitude           Decimal          @db.Decimal(10, 7)
  pickupAddress             String?          @db.VarChar(500)
  dropoffLatitude           Decimal          @db.Decimal(10, 7)
  dropoffLongitude          Decimal          @db.Decimal(10, 7)
  dropoffAddress            String?          @db.VarChar(500)
  estimatedDistanceMeters   Int?
  estimatedDurationSeconds  Int?
  baseFare                  Decimal          @db.Decimal(12, 2)
  distanceFare               Decimal          @db.Decimal(12, 2)
  timeFare                   Decimal          @db.Decimal(12, 2)
  totalFare                  Decimal          @db.Decimal(12, 2)
  requestedAt               DateTime         @default(now())
  assignedAt                DateTime?
  arrivedAt                 DateTime?
  startedAt                 DateTime?
  completedAt                DateTime?
  cancelledAt                DateTime?
  cancelledBy                 RideCancelledBy?
  cancellationReason           String?          @db.VarChar(500)
  customer                  User             @relation("RideCustomer", fields: [customerId], references: [id], onDelete: Cascade)
  driver                    User?            @relation("RideDriver", fields: [driverId], references: [id], onDelete: SetNull)
  trackingPoints             RideTracking[]

  @@index([customerId])
  @@index([driverId])
  @@index([status])
  @@index([requestedAt])
  @@map("rides")
}

model RideTracking {
  id        String   @id @default(uuid()) @db.Uuid
  rideId    String   @map("ride_id") @db.Uuid
  latitude  Decimal  @db.Decimal(10, 7)
  longitude Decimal  @db.Decimal(10, 7)
  heading   Float?
  speed     Float?
  createdAt DateTime @default(now())
  ride      Ride     @relation(fields: [rideId], references: [id], onDelete: Cascade)

  @@index([rideId, createdAt])
  @@map("ride_tracking")
}

model DriverAvailability {
  driverId        String    @id @map("driver_id") @db.Uuid
  online          Boolean   @default(false)
  acceptingRides  Boolean   @default(false) @map("accepting_rides")
  vehicleType     RideType  @map("vehicle_type")
  latitude        Decimal?  @db.Decimal(10, 7)
  longitude       Decimal?  @db.Decimal(10, 7)
  activeRideCount Int       @default(0) @map("active_ride_count")
  updatedAt       DateTime  @updatedAt
  driver          User      @relation(fields: [driverId], references: [id], onDelete: Cascade)

  @@index([online, acceptingRides, vehicleType])
  @@map("driver_availability")
}

model DriverKyc {
  id                 String                @id @default(uuid()) @db.Uuid
  driverId           String                @map("driver_id") @db.Uuid
  documentType        KycDocumentType       @map("document_type")
  documentNumber      String                @map("document_number") @db.VarChar(100)
  frontImage          String                @map("front_image") @db.VarChar(2048)
  backImage           String?               @map("back_image") @db.VarChar(2048)
  verificationStatus  KycVerificationStatus @default(PENDING) @map("verification_status")
  reviewedBy          String?               @map("reviewed_by") @db.Uuid
  reviewedAt          DateTime?             @map("reviewed_at")
  remarks             String?               @db.VarChar(1000)
  createdAt           DateTime              @default(now())
  driver               User                  @relation(fields: [driverId], references: [id], onDelete: Cascade)

  @@index([driverId])
  @@index([verificationStatus])
  @@map("driver_kyc")
}
```

`RideTracking` persists periodic snapshots for audit/history/reconnect-recovery — the live, low-latency feed to the passenger's screen is the WebSocket, not a poll against this table. Same dual-path a lot of ride-hailing systems use: WS for "now," a DB row trail for "what actually happened."

### `DriverProfile`/`RiderProfile` disposition (recommendation, not yet locked)

The audit found both orphaned. Recommendation: **repurpose `DriverProfile` as the real driver identity** — `DriverKyc` above hangs off `driverId` (a `User.id`, matching the `DeliveryJob`/`RiderAvailability` convention of relating to `User` directly) rather than `DriverProfile.id`, for consistency with how the working delivery system already does it. That leaves `DriverProfile`/`DriverOnboarding` genuinely still unused after Ride ships too, unless a decision is made to route driver approval status through `DriverProfile.isApproved` instead of inventing a new approval flag. **This still needs an explicit answer before RIDE-002**: either (a) `DriverProfile.isApproved` becomes the real "is this driver allowed to go online" gate, checked by `DriverAvailability` writes, or (b) `DriverProfile` gets dropped entirely and a new field serves that purpose. `RiderProfile` is out of scope for Ride — it stays exactly as orphaned as the audit found it, a separate cleanup decision.

## 3. Dispatch — extending the existing nearest-candidate pattern

`AssignmentService.findNearestRider()` returns a single best candidate with no offer/timeout/reassignment loop. Ride needs that loop, because a passenger can't wait indefinitely on one driver's app to respond. Proposed:

1. On `REQUESTED`, find nearest `DriverAvailability` where `online && acceptingRides && vehicleType == ride.rideType && activeRideCount == 0` (single active ride, unlike delivery's `MAX_RIDER_ACTIVE_JOBS = 3` — a driver can't be mid-trip with two passengers).
2. Push an offer to that driver over their personal WebSocket channel (`driver:<driverId>`), start a short timer (e.g. 15s — exact value is a tuning decision, not an architectural one) held in Redis (already in the stack, used here as short-lived offer state, not persisted to Postgres).
3. Driver accepts → `Ride.status = DRIVER_ASSIGNED`, `driverId` set, offer timer cleared, both parties join the ride's WebSocket room (`ride:<rideId>`).
4. Driver declines, or timer expires → move to the next-nearest candidate, repeat.
5. Candidates exhausted (or a max-attempts cap, to bound how long a customer waits) → `Ride.status = NO_DRIVERS_FOUND`.

This reuses the exact matching primitive (`haversineMeters`, nearest-first sort) from `delivery`'s `AssignmentService` — genuinely shared code, not a rewrite — extended with the offer loop the audit flagged as missing.

## 4. Fare calculation

```
totalFare = baseFare + (distanceKm × perKmRate) + (durationMinutes × perMinuteRate)
```

Mirrors `DeliveryFeeService`'s use of `haversineMeters` for distance, adds a time component `DeliveryFeeService` doesn't have (delivery doesn't charge for courier wait/travel time the way a passenger fare does). Rate constants (`baseFare`, `perKmRate`, `perMinuteRate`) per `RideType` — Tricycle rates presumably lower than Economy, exact values are a pricing/business decision for the founder, not something to hardcode here. No surge multiplier, per the locked decision.

## 5. Real-time architecture

NestJS `@nestjs/websockets` gateway (the backend already runs on NestJS; this is the first-party fit, no new framework dependency). Design:

- **Auth**: JWT verified on socket connection handshake, same token scheme as the REST API — no separate auth mechanism.
- **Rooms**: `ride:<rideId>` — customer and driver both join once a ride reaches `DRIVER_ASSIGNED`; driver's location pushes and ride-status transitions broadcast to this room.
- **Personal channels**: `driver:<driverId>` — used for ride offers before a ride room exists (steps 2–4 above).
- **Events (indicative, not final)**: `ride:offer`, `ride:offer:accepted`, `ride:offer:declined`, `ride:status`, `ride:driver-location`, `ride:cancelled`.
- **Fallback**: on reconnect, a client fetches current state via REST (`GET /rides/:id`, including the latest `RideTracking` row) rather than relying on the socket to have buffered anything — same "REST for state, WS for live updates" split most real-time systems use.

This is new infrastructure — nothing in the current backend does this today (confirmed via the audit's repo-wide search). Scope it as its own implementation slice in RIDE-002, not something that falls out of the schema work.

## 6. API surface (sketch, mirroring delivery's three-sided pattern)

| Controller               | Indicative endpoints                                                                | Audience  |
| ------------------------ | ----------------------------------------------------------------------------------- | --------- |
| `CustomerRideController` | request ride, get ride, cancel, ride history                                        | Customer  |
| `DriverRideController`   | list/respond to offers, arrived, start trip, complete, availability, KYC submission | Driver    |
| `AdminRideController`    | list, get, force-cancel, KYC review                                                 | Admin/Ops |

Permission constants follow the existing convention: `customer:ride:manage`, `driver:ride:manage`, `admin:ride:manage` (mirroring `DELIVERY_PERMISSIONS`).

## 7. Reused as-is (no new work)

- **Notifications**: same `notifyDeliveryLifecycle`-style pattern → `notifyRideLifecycle`, wired the same way `DeliveryService` already does it.
- **Wallet**: `RiderWalletController`'s pattern extends to drivers — same payout mechanism, needs the same follow-up check the audit flagged (confirm fee-crediting actually triggers automatically, don't assume).
- **Rating**: `ReviewTargetType` already includes a target type usable for post-ride rating — no schema change needed here, confirmed in the audit.
- **Distance math**: `haversineMeters` from `delivery/delivery-fee.service.ts` — literally reused, not reimplemented.

## 8. Explicitly out of scope for the pilot

- Surge pricing
- Ride types beyond Economy/Tricycle (Premium, XL, Bike — not built now, `RideType` enum can extend later)
- Insurance document verification (deferred per the locked onboarding decision)
- Multi-stop rides, scheduled/future rides, ride-sharing/pooling

## 9. Open item before RIDE-002 can start

The `DriverProfile.isApproved` question in §2 needs an explicit answer — it's the one piece of this spec that's a recommendation, not a locked decision, because it directly determines whether `DriverProfile` finally gets wired to something real or gets removed as dead schema.
