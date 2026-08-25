# RIDE-001A — Ride Backend Reality Audit

**Date:** 2026-08-01
**Method:** Same standard as every audit in this repo — every finding below comes from reading the actual Prisma schema, actual service/controller code, and actual test files, not from any prior document's claims. Nothing here was informed by the `dripplex-complete-source-code` Figma export (`docs/FIGMA-SOURCE-INVENTORY.md` already established that branch has no Ride implementation to reference).

## Headline finding

**There is no passenger ride-hailing system in this codebase.** What exists is a mature, tested, real **package-delivery-for-marketplace-orders** system (`delivery` module), built around a courier ("Rider") fulfilling an `Order`. It is architecturally close to what ride-hailing dispatch needs — nearest-candidate matching, job lifecycle, GPS posting, fee calculation — but every part of it is modeled around delivering a package to an address, not transporting a passenger from A to B. "Ride" work is not a wiring exercise; a real subset of it is new build, informed by a reusable pattern.

Separately, **`driver-portal` — the app whose own `package.json` describes it as "DrippleX driver portal for ride-hailing operations" — has zero source files.** It was created in the initial Turborepo scaffold commit and never touched again. This wasn't caught by the R1.6 audit or the earlier Implementation Audit; both only enumerated the five portals that had been actively worked on (`customer-web`, `merchant-portal`, `rider-portal`, `admin-portal`, `operations-console`). `driver-portal` is a sixth app in `apps/` that nobody has built anything in, ever.

## 1. Existing entities

| Model                                                             | Real?                                   | Notes                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DeliveryJob`                                                     | ✅ Already complete                     | Tied to `orderId` (1:1) — a delivery job only exists because a marketplace order exists. Has pickup/dropoff lat-lng, estimated distance/duration, fee, full lifecycle timestamps (assigned/accepted/pickedUp/arrived/delivered/failed/cancelled/returned), cancellation reason.                          |
| `DeliveryTracking`                                                | ✅ Already complete                     | Append-only GPS points (lat, lng, heading, speed, accuracy) per delivery job.                                                                                                                                                                                                                            |
| `DeliveryProof`                                                   | ✅ Already complete                     | Photo/OTP/signature proof-of-delivery, polymorphic `proofType`.                                                                                                                                                                                                                                          |
| `RiderAvailability`                                               | ✅ Already complete                     | Online/accepting-orders flags, current lat-lng, active job count — keyed directly on `User.id`, not on `RiderProfile`.                                                                                                                                                                                   |
| `RiderProfile` / `RiderOnboarding`                                | 🟡 Partially complete, but **orphaned** | Exists, has an approval/onboarding flow — but confirmed via grep, **zero references anywhere in the actual delivery business logic**. `DeliveryJob.rider` and `RiderAvailability.rider` both relate directly to `User`, not `RiderProfile`. This table tracks nothing the working system actually reads. |
| `DriverProfile` / `DriverOnboarding`                              | 🔴 Missing (in effect)                  | Same shape as `RiderProfile` (id, userId, isApproved, approvedAt, onboarding). **Zero references anywhere outside the schema and its own onboarding model** — no service, no controller, no business logic touches `DriverProfile` at all. This is scaffolding for a feature that was never built.       |
| No `Ride`, `Trip`, `RideRequest`, `VehicleType`, `FareRule` model | 🔴 Missing                              | Nothing like this exists. Passenger ride-hailing has no data model today.                                                                                                                                                                                                                                |

**Duplicate/Deprecated classification:** `RiderProfile` and `DriverProfile` are structurally near-identical and both unused by real code. This looks like early-stage scaffolding (likely from the original 23-chapter backend build) for a Rider/Driver distinction that was never carried through — the system that actually shipped uses plain `User` + `RiderAvailability` instead. Recommend explicitly deciding whether `DriverProfile` becomes the real ride-hailing driver model (rename/repurpose) or gets removed as dead schema — leaving it as-is invites a second team member to "wire it up" to nothing real.

## 2. Existing APIs

Real, tested, RBAC-scoped, three-sided (customer/rider/admin) — for delivery, not rides:

| Controller                                               | Endpoints                                                                                            | Audience  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| `CustomerDeliveryController` (`customer/orders/:id/...`) | `delivery`, `tracking`, `eta` (all GET, read-only)                                                   | Customer  |
| `RiderDeliveryController` (`rider/delivery/jobs/...`)    | list, get, accept, reject, pickup, **location** (POST), arrived, deliver, fail, return, availability | Rider     |
| `AdminDeliveryController` (`admin/delivery/...`)         | list, get, assign, reassign, cancel                                                                  | Admin/Ops |

This is a genuinely complete job-lifecycle API — the pattern (accept → pickup ≈ start-trip → arrived → deliver ≈ end-trip) maps closely to what a ride flow needs, but every payload and permission (`customer:delivery:read`, `rider:delivery:manage`, `admin:delivery:manage`) is delivery-specific and would need parallel ride-scoped versions, not a rename.

## 3. Existing dispatch logic

`AssignmentService.findNearestRider()` — real, but simple: pulls all `RiderAvailability` rows with `online && acceptingOrders && activeJobCount < MAX_RIDER_ACTIVE_JOBS` (3), computes haversine distance to the pickup point for each, returns the single nearest one. No offer/timeout/decline-and-reassign loop visible in this service — worth checking `delivery.service.ts`'s calling code for whether unaccepted assignments retry against the next-nearest candidate.

**Already complete** as a nearest-candidate matching primitive; **missing** everything ride-hailing dispatch typically needs beyond that: concurrent multi-driver offer broadcast, accept-race handling, surge-aware matching, ride-type filtering (a "Comfort" request shouldn't match a bicycle courier).

## 4. Existing wallet

`RiderWalletController` (`rider/wallet`) exists and is live — confirmed both in code and via the Railway production logs from Gate R1.6.1's verification (`Mapped {/api/v1/rider/wallet, GET} route`, actually running in production right now). **Already complete** as far as a rider having a wallet endpoint goes. What's not verified in this audit: whether delivery-fee earnings actually flow into that wallet automatically on job completion, or whether payout crediting is a separate, unwired manual step — that needs a follow-up read of the wallet service's credit triggers before RIDE-001B assumes it "just works" for ride earnings too.

## 5. Existing pricing

`DeliveryFeeService.estimate()` — real, but minimal: `fee = max(MIN_DELIVERY_FEE, round(distanceKm × FEE_PER_KM))`, flat rate (₦500 minimum, ₦150/km), optional merchant override, no time-of-day/demand/surge factor, no per-minute component. **Already complete** for flat-rate package delivery pricing; **missing** everything a passenger fare model needs — base fare + distance + time, ride-type multipliers (Standard/Comfort/XL), surge pricing. The `haversineMeters()` distance primitive itself is directly reusable.

## 6. Existing notifications

`DeliveryService` calls `notifications.notifyDeliveryLifecycle()` on lifecycle transitions — confirmed real, not just declared. **Already complete** as an integration pattern; a ride-hailing equivalent (`notifyRideLifecycle` or similar) would follow the same shape but doesn't exist yet.

## 7. Existing "driver" tracking

`DeliveryTracking` — riders POST their lat/lng/heading/speed/accuracy periodically (`TRACKING_THROTTLE_MS = 5000`, i.e. client-side throttled to one post per 5s), customers read it via a GET endpoint (polling, not pushed). **No WebSocket, SSE, or any push-based real-time layer exists anywhere in the backend** — confirmed via a repo-wide search for `WebSocketGateway`/`socket.io`. For a delivery ETA that updates every 5–10 seconds via polling, this is adequate. For a customer watching a driver's dot move on a map in real time during an active ride — the standard ride-hailing UX — REST polling at this throttle is a genuinely different (worse) experience, and would be the biggest net-new infrastructure piece, not a reuse.

## 8. Test coverage

73 `it()` blocks across the delivery module's `.spec.ts` files (`assignment.service`, `delivery-fee.service`, `delivery.constants`, `delivery.permissions`, `delivery.service`, `tracking.service`). Real, not stubbed — consistent with this repo's actual testing discipline everywhere else.

## 9. Review/rating

`ReviewTargetType` enum already includes `RIDER` alongside `PRODUCT`/`MERCHANT` — confirmed in schema. **Already complete**: rating a rider (and, by extension, a future driver) after job completion is already structurally supported by the existing polymorphic review system. No new model needed here.

## 10. Summary classification

| Area                                                                         | Classification                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Delivery job lifecycle (entities, APIs, services)                            | ✅ Already complete — for package delivery                                                       |
| Nearest-candidate dispatch matching                                          | 🟡 Partially complete — good primitive, missing offer/accept-race/ride-type logic                |
| Wallet payout endpoint                                                       | ✅ Already complete (needs a follow-up check: does fee crediting actually trigger automatically) |
| Pricing/fare calculation                                                     | 🟡 Partially complete — flat distance rate only, no passenger fare model                         |
| Lifecycle notifications                                                      | ✅ Already complete — pattern is real and reusable                                               |
| Real-time driver location for a passenger UX                                 | 🔴 Missing — REST polling only, no push layer                                                    |
| Rider/passenger rating                                                       | ✅ Already complete — schema already supports it                                                 |
| `RiderProfile`/`DriverProfile`                                               | 🟠 Duplicate/orphaned — unused by any real code, needs an explicit decision                      |
| `driver-portal` frontend                                                     | 🔴 Missing entirely — zero source files despite existing as a named app                          |
| Passenger ride data model (`Ride`, `RideRequest`, fare rules, vehicle types) | 🔴 Missing — doesn't exist                                                                       |

## 11. Recommendation for RIDE-001B (implementation)

Don't build Ride from a blank page, and don't try to "wire up" `DriverProfile` — it isn't connected to anything to wire. Instead:

1. **Reuse the architecture, not the tables.** The delivery module's shape (job entity → lifecycle state machine → assignment service → tracking → lifecycle notifications → wallet payout → post-completion rating) is the right pattern for Ride. Building `Ride`/`RideRequest` as siblings to `DeliveryJob` (not extensions of it — a ride isn't a delivery) following the same architecture is faster and safer than trying to generalize `DeliveryJob` to cover both.
2. **Resolve `DriverProfile` vs `RiderProfile` first**, before any Ride schema work — decide whether `DriverProfile` becomes the real passenger-ride driver identity or gets removed, so RIDE-001B doesn't add a third parallel unused profile table.
3. **Real-time tracking is the one piece with no existing foundation at all.** If live in-ride tracking is a launch requirement (per the Kano-first Ride strategy, it likely is), scope a WebSocket/SSE layer as its own piece of infrastructure work, not something that falls out of extending `DeliveryTracking`.
4. **Passenger fare calculation needs real product input** (base fare, per-minute rate, ride-type tiers, surge rules) before implementation — `DeliveryFeeService`'s flat per-km model is not that, and guessing at fare economics isn't an engineering decision to make unilaterally.
5. **`driver-portal` needs a decision too**: build it out as the real driver-facing app (matching its own package.json's stated purpose), or fold ride-hailing into `rider-portal` and treat `driver-portal` as dead scaffolding to remove. Either is defensible; leaving it as an empty app nobody mentions is not.
