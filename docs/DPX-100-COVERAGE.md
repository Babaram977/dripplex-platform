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
| Ride            |                                                                                  30 |         0/30 † |                                                                                                                                                                                                 ~20/30 † |  ~20/30 † |      — |
| Wallet          |                                                                                  10 |           0/10 |                                                                                                                                        0/10 (only `WalletPaySuccessScreen` exists, inside the Ride flow) |      0/10 |      — |
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

## Seed data policy (Phase 1 / Phase 2)

Per founder direction: seed data (`apps/backend/prisma/seed-data/`,
applied via `apps/backend/prisma/seed.ts`) is temporary testing
infrastructure only, centralized in one place, never hardcoded into the
frontend. Every screen fetches through the real SDK/backend — swapping
seed rows for live production data requires no presentation-layer code
change. Phase 2, once a module is fully live, its seed block is simply
dropped from `seed.ts`.

_Last updated: 2026-08-03, after Product Detail._
