# DPX-100 Coverage Tracker

Live view of Figma-Make-export → production progress, per the founder's
request. Updated as each screen moves through the pipeline. Two things
this tracker deliberately keeps separate, because conflating them would
overstate progress:

- **DPX-100 ported** — the screen has been rebuilt in
  `packages/ui/src/components/super-app/`, tracked in `MATURITY.md`, and
  follows the DPX-100/101/102 discipline (packages/ui owns all UI,
  component maturity levels, pixel parity against the locked Figma
  export).
- **Real & functional (pre-DPX-100)** — Ride, Driver, and Merchant
  already have working, backend-connected, Playwright-verified
  production screens built _before_ DPX-100 existed, using their own
  component libraries (e.g. `apps/customer-web/src/components/ride/`).
  They are real and shipped, but have not gone through the DPX-100
  `packages/ui/super-app` port yet — that's still ahead of them per the
  founder's own module ordering.

`Figma Screens` counts are real, taken directly from
`docs/reference/figma-super-app-source/` (each named `export function
...Screen`).

| Module          |                                                                       Figma Screens | DPX-100 Ported |                                                                                                                                                                           Real Route (backend-connected) |  Verified | Locked |
| --------------- | ----------------------------------------------------------------------------------: | -------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | --------: | -----: |
| Home            |                                                                                   1 |            1/1 |                                                                                                                                                                                    0/1 (`/preview` only) |       1/1 |    1/1 |
| Marketplace     |                                                                                   6 |            6/6 |                                                                                                                                                           4/6 (Product Detail, Cart, Checkout, Tracking) |       6/6 |    0/6 |
| Ride            |                                                                                  30 |          22/30 |                                                                                                                                                                                          22/30 (`/ride`) |     22/30 |      — |
| Wallet          |                                                                                  10 |           1/10 |                                                                                                                                                                             1/10 (`/wallet` — Home only) |      1/10 |      — |
| Driver          |                                                                                  13 |         0/13 † | partial † (`apps/driver-portal`, different screen set — dashboard/wallet/earnings/trip/history/profile/campaign, not a 1:1 port of `driverScreen.tsx`'s Splash/Login/OTP/KYC/DocsUpload/VehicleReg flow) | partial † |      — |
| Merchant        |               — (`adminConsoleScreen.tsx`-style single file, not screen-enumerated) |              0 |                                                                                       partial † (`apps/merchant-portal` — dashboard, product CRUD, publish/images/variants/inventory, built pre-DPX-100) | partial † |      — |
| Admin           |                                                             1 (single-file console) |            0/1 |                                                                                                              0/1 (`apps/admin-portal` exists; not audited against `adminConsoleScreen.tsx` in this pass) |         — |      — |
| Auth/Onboarding |                                                      29 (`screensA`–`screensD.tsx`) |           0/29 |                                                                                                                                                                                                     0/29 |      0/29 |      — |
| Orders          | — (no dedicated Figma screen file found; likely folded into Ride/Marketplace flows) |              — |                                                                                                                                                                                                        — |         — |      — |
| AI (Ask Drip)   |          — (embedded as a sheet within other screens, not a standalone screen file) |              — |                                                                                                                                                                                                        — |         — |      — |

† Built and shipped via a separate, earlier component library
(`apps/customer-web/src/components/ride/`, `apps/driver-portal`,
`apps/merchant-portal`) — real backend, real Playwright verification at
the time, but **not yet run through the DPX-100 port** into
`packages/ui/src/components/super-app/` or tracked in `MATURITY.md`.
Counts are approximate (file-existence check, not a full screen-by-screen
audit) and will be corrected when each module's DPX-100 pass actually
starts.

## Marketplace detail (the module currently in progress)

| Screen                                     | DPX-100 Ported | Real Route                           | Verified | Locked |
| ------------------------------------------ | -------------- | ------------------------------------ | -------- | ------ |
| Entry (`marketplaceScreen.tsx`)            | ✅             | ❌ (`/preview/marketplace-v2` only)  | ✅       | ❌     |
| Store (`storeScreen.tsx`)                  | ✅             | ❌ (`/preview/store-v2` only)        | ✅       | ❌     |
| Product Detail (`productDetailScreen.tsx`) | ✅             | ✅ `/marketplace/products/[id]`      | ✅       | ❌     |
| Cart (`cartScreen.tsx`)                    | ✅             | ✅ `/marketplace/cart`               | ✅       | ❌     |
| Checkout (`checkoutScreen.tsx`)            | ✅             | ✅ `/marketplace/checkout`           | ✅       | ❌     |
| Tracking (`trackingScreen.tsx`)            | ✅             | ✅ `/marketplace/tracking/[orderId]` | ✅       | ❌     |

Entry and Store still need the same real-route migration Product Detail
just got (out of `(public)`, into the `(marketplace)` SuperApp shell) —
noted as outstanding, not forgotten.

## Marketplace stabilization pass — Production Candidate (2026-08-04)

Per the founder's request, a full end-to-end walkthrough was run against
the real backend (not per-screen isolation) to verify Marketplace as a
complete product: register a new customer → browse Marketplace → open a
store → view a product → add to cart → save an item for later → checkout
→ create an order → attempt payment → track the order → review order
history → verify the merchant sees the order → verify the rider/driver
receives the delivery job → confirm notifications, loading, empty, and
error states throughout.

**Result: PASS. Marketplace is a Production Candidate.**

Every step above was exercised against the real backend (fresh customer
registration + OTP, real cart/checkout/order/delivery state machines, a
freshly-registered-and-approved test rider, and the seeded KFC Nigeria
merchant) and confirmed correct. Key confirmations:

- Full order lifecycle verified end-to-end through real API calls: PENDING
  → CONFIRMED → PREPARING → READY (merchant `accept`/`ready`) → auto-dispatch
  to the nearest online rider → DRIVER_ASSIGNED → PICKED_UP → DELIVERED
  (rider `accept`/`pickup`/`arrived`/`deliver`), with `Order.status`
  correctly auto-syncing to each `DeliveryJob.status` transition throughout.
- Merchant order visibility confirmed via the real `GET /merchant/orders`
  API — the merchant sees exactly the orders placed against their store,
  with correct data.
- Rider delivery-job visibility confirmed via the real `GET /rider/jobs`
  API — the auto-dispatch algorithm (`AssignmentService.findNearestRider`)
  correctly assigned the job to the nearest online, accepting rider.
- Order History confirmed at the API level (`GET /customer/orders`) —
  correct data and ordering. No dedicated Order History _screen_ exists
  yet in customer-web; that's tracked under the "Orders" module in the
  founder's own module ordering (Marketplace → Ride → Wallet → **Orders**
  → ...), not a Marketplace gap.
- Notifications confirmed firing correctly through the real lifecycle
  (`WELCOME`, `ORDER_ACCEPTED`, `ORDER_READY`, `DELIVERY_COMPLETED`).
- Empty/error states confirmed genuine and correct, not fabricated: an
  unconfigured Paystack gateway correctly surfaces a real 422 error to the
  customer (no local sandbox payment credentials exist in this dev
  environment); an unassigned delivery job correctly reflects "no rider
  available" until one comes online; a nonexistent merchant ID correctly
  renders "Merchant not found" rather than crashing.

**One real bug found and fixed during the pass:** `apps/customer-web/src/app/(marketplace)/marketplace/checkout/page.tsx`'s
`onPlaceOrder` wrapped `sdk.orders.checkout()` and `sdk.orders.payOrder()`
in a single try/catch. When checkout succeeded but payment initialization
failed (the expected case in this environment — no gateway credentials —
but also a real-world case: gateway downtime, network failure), the order
was created and its cart was locked (`CartService` correctly refuses to
modify a cart mid-checkout — `cart.service.ts:374`), but the customer was
left stranded on the checkout page with a toast and a cart that could no
longer be modified (add/remove/save-for-later all 422'd with "Cart is
locked pending payment"), and no visible path to recover — the only
unlock path (`CheckoutService.cancelCustomerOrder` sets the cart back to
`ACTIVE`) requires navigating to the order's Tracking screen, which
nothing routed the customer to. Fixed by splitting the two calls into
separate try/catch blocks; on a payment-initialization failure the
customer is now redirected to `/marketplace/tracking/[orderId]`, where
the real, already-existing "Cancel Order" action (valid for `PENDING`
orders) unlocks their cart again.

**Two smaller gaps found and documented, not fixed (out of Marketplace's
scope):**

1. `DeliveryService` only notifies the customer at the rider's
   `picked_up`/`arriving`/`delivered` transitions (`delivery.service.ts`
   lines 260/294/337) — there is no notification when a rider is first
   _assigned_. The customer only learns a rider exists once pickup
   happens. Minor UX gap in the Delivery/Notification domain, not
   Marketplace-specific; worth picking up alongside the Driver module.
2. Rider `RiderAvailability` records (`listAvailableRiders` in
   `prisma-delivery.repository.ts:231`) are eligible for auto-dispatch
   based only on `online`/`acceptingOrders`/active-job-count — not
   `RiderProfile.isApproved`. There is also no admin rider-approval
   endpoint yet (`RiderProfile.isApproved` currently has no real path to
   `true` outside direct DB access). Both belong to the future Driver
   module's approval workflow, not Marketplace.
3. **Auth, cross-cutting, not Marketplace-specific:** `AuthService.login`
   and `AuthService.verifyOtp` (`auth.service.ts`) both issue tokens via
   `issueScaffoldTokens`, which omits `sid`/`role`/`portal` from the JWT
   payload. `JwtStrategy.validate` (`jwt.strategy.ts:34`) requires all
   three and rejects the token outright ("Invalid access token payload")
   on any permission-gated route. The real, working login path is the
   portal-specific `LoginService` (`POST /auth/login/:portal`), which
   customer-web already uses correctly (`RegisterForm`/`VerifyOtpForm`
   redirect to `/login` rather than using the verify-response tokens
   directly) — so this doesn't affect the Marketplace customer flow. It
   would affect any client that trusts `/auth/otp/verify` or the generic
   `/auth/login` to return directly-usable tokens. Flagged here rather
   than fixed in this pass since it's shared auth infrastructure touching
   all four portals, not scoped to Marketplace.

## Ride detail — DPX-100 port complete (2026-08-04)

Ride is architecturally different from every other module in this
tracker: it already had a complete, real, backend-connected, previously
Playwright-verified implementation (RIDE-003 Slices 1-4), built _before_
DPX-100 existed, using its own component library
(`apps/customer-web/src/components/ride/`) instead of `packages/ui`. The
DPX-100 pass here was a re-platform across five slices, not new
construction: move each screen's presentational markup into
`packages/ui/src/components/super-app/` and have the already-wired
screen component (which stays in `customer-web`, since it owns the real
hooks/backend calls) compose the new pieces — no new backend work, no
behavior change, verified against the same real API this module has used
since RIDE-003. All 22 real Ride screens are now ported and Playwright-verified.

| Screen                          | Pre-DPX-100 Real Route | DPX-100 Ported | Verified |
| ------------------------------- | ---------------------- | -------------- | -------- |
| Ride Home                       | ✅ `/ride`             | ✅             | ✅       |
| Destination Search              | ✅ `/ride`             | ✅             | ✅       |
| Fare Estimate                   | ✅ `/ride`             | ✅             | ✅       |
| Finding Driver                  | ✅ `/ride`             | ✅             | ✅       |
| Driver Assigned + Profile Sheet | ✅ `/ride`             | ✅             | ✅       |
| Driver En Route                 | ✅ `/ride`             | ✅             | ✅       |
| Driver Arrived                  | ✅ `/ride`             | ✅             | ✅       |
| Ride In Progress                | ✅ `/ride`             | ✅             | ✅       |
| Live Tracking                   | ✅ `/ride`             | ✅             | ✅       |
| Trip Completed                  | ✅ `/ride`             | ✅             | ✅       |
| Payment / Gateway / Cash        | ✅ `/ride`             | ✅             | ✅ ‡     |
| Wallet Pay Success              | ✅ `/ride`             | ✅             | ✅       |
| Tip Driver                      | ✅ `/ride`             | ✅             | ✅       |
| Rate Driver                     | ✅ `/ride`             | ✅             | ✅       |
| Trip Receipt                    | ✅ `/ride`             | ✅             | ✅       |
| Report Trip                     | ✅ `/ride`             | ✅             | ✅       |
| Ride History                    | ✅ `/ride`             | ✅             | ✅       |
| Saved Places                    | ✅ `/ride`             | ✅             | ✅       |

All 22 real Ride screens share one route (`/ride`) driven by a flat
`ride-flow.tsx` state machine rather than one Next.js page per screen —
the "Real Route" column reflects that shared route, not per-screen URLs.
See `packages/ui/src/components/super-app/MATURITY.md`'s "Ride module"
section for the slice-by-slice port log.

Not yet Locked — pending founder confirmation, per the same discipline
applied to Marketplace.

‡ Wallet and Cash payment methods were verified end-to-end against the
real backend (real wallet balance, real driver `cash-confirm`). The
gateway path (Paystack/Flutterwave/OPay) is typecheck/lint clean and
composed only of already-Verified primitives, but wasn't exercised
end-to-end — no real gateway credentials exist in this sandbox, the same
environmental limitation documented during the Marketplace checkout
stabilization pass.

## Wallet detail (the module currently in progress)

Unlike Ride, Wallet has no pre-existing customer-web route to re-platform
— this is a true from-scratch DPX-100 build (like Marketplace's approach).
The backend (`apps/backend/src/wallet/`), SDK (`WalletClient`), and shared
types already existed in full for balance + transactions, so each slice is
real backend integration from the start.

| Screen              | DPX-100 Ported | Real Route      | Verified |
| ------------------- | -------------- | --------------- | -------- |
| Wallet Home         | ✅             | ✅ `/wallet`    | ✅       |
| Transaction History | ❌             | ❌              | ❌       |
| Top Up              | ❌             | ❌              | ❌       |
| Withdraw            | ❌             | ❌ (no backend) | ❌       |
| Transfer            | ❌             | ❌              | ❌       |
| Payment Methods     | ❌             | ❌              | ❌       |
| Rewards             | ❌             | ❌              | ❌       |
| Wallet Statement    | ❌             | ❌ (no backend) | ❌       |
| Wallet Security     | ❌             | ❌ (no backend) | ❌       |
| Wallet Settings     | ❌             | ❌ (no backend) | ❌       |

Withdraw has zero customer-facing backend today: no `CUSTOMER_WITHDRAW`
permission, no controller endpoint, no customer-linked bank-account model,
and no payout-provider capability (the Paystack/Flutterwave/Moniepoint
adapters only support charge collection, not transfers/payouts). Per
founder direction, Slice 4 will build this for real (bank-account linking,
a payout provider call, permission/controller/DTOs/service) rather than
fake it or skip it. Wallet Statement/Security/Settings similarly have no
backend (no PDF export, no PIN/2FA, no settings persistence) and will be
documented as honest capability gaps in the module's production audit
rather than built with fake data.

See `packages/ui/src/components/super-app/MATURITY.md`'s "Wallet module"
section for the slice-by-slice port log.

## Seed data policy (Phase 1 / Phase 2)

Per founder direction: seed data (`apps/backend/prisma/seed-data/`,
applied via `apps/backend/prisma/seed.ts`) is temporary testing
infrastructure only, centralized in one place, never hardcoded into the
frontend. Every screen fetches through the real SDK/backend — swapping
seed rows for live production data requires no presentation-layer code
change. Phase 2, once a module is fully live, its seed block is simply
dropped from `seed.ts`.

_Last updated: 2026-08-04, after Ride Slice 5 (Ride History, Saved
Places) — the Ride module's DPX-100 port is now complete (22/22 real
screens ported and Playwright-verified)._
