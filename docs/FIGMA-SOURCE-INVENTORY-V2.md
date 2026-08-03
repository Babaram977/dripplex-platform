# Figma Source Inventory v2 — `DrippleX_Super_App_Design_Copy.zip`

**Date:** 2026-08-03
**Source:** Figma Make export, provided directly as a zip (Figma's design-file
connector cannot reach Figma Make prototypes — confirmed this session — so
this is the correct channel, same as `docs/FIGMA-SOURCE-INVENTORY.md` used
for the RIDE-003 export). Preserved in full under
`docs/reference/figma-super-app-source/`.

**Method:** Same standard as the original inventory — every claim below comes
from reading the actual files, not chat descriptions or screenshots.

## 0. This supersedes the previous inventory's placeholder finding

`docs/FIGMA-SOURCE-INVENTORY.md` (2026-08-01) found 8 of 17 `src/features/`
modules were empty placeholders — no Ride, Driver, Wallet, Merchant, or Admin
screens existed anywhere. **That is no longer true.** This export has real,
substantial screen implementations for every one of those modules:

| File                                 | Lines | Status                      |
| ------------------------------------ | ----- | --------------------------- |
| `rideScreen.tsx`                     | 2,873 | Real — 29 screen components |
| `homeScreen.tsx`                     | 857   | Real                        |
| `walletScreen.tsx`                   | 1,345 | Real                        |
| `driverScreen.tsx`                   | 1,703 | Real                        |
| `adminConsoleScreen.tsx`             | 1,856 | Real                        |
| `marketplaceScreen.tsx`              | 896   | Real                        |
| `storeScreen.tsx`                    | 651   | Real                        |
| `productDetailScreen.tsx`            | 846   | Real                        |
| `cartScreen.tsx`                     | 675   | Real                        |
| `checkoutScreen.tsx`                 | 592   | Real                        |
| `trackingScreen.tsx`                 | 576   | Real                        |
| `screensA.tsx`–`screensD.tsx` (Auth) | 5,770 | Real, ~40 screens           |

**19,383 lines total** across `src/app/*.tsx`. Plus a complete, real design
token system (`src/tokens/*`) and the actual brand identity reference image
(`src/imports/Dripplex_brand_id.png`). This is the full super-app vision —
Ride, Marketplace/Store/Product/Cart/Checkout, Wallet, Driver console, Admin
console, Auth — as one coherent design system.

## 1. Two concrete conflicts — need your call before I touch code

### 1.1 Brand color tokens don't match what's currently "official" in the repo

`packages/ui/src/brand/tokens.ts` (in `main` today) declares:

```
primary: '#0E7A3E'   // "Emerald Green"
secondary: '#0A2540' // "Deep Navy"
accent: '#FFC107'    // "Sunshine Yellow"
```

This export's `src/tokens/colors.ts` — explicitly commented `"locked. Do not
modify without design approval"` — declares:

```
BRAND_GREEN_DARK  = "#176B30"
BRAND_GREEN_MID   = "#2BAC52"   // primary brand green
BRAND_GREEN_LIGHT = "#47CF72"
NAVY_DEEP    = "#060E1C"
NAVY_BASE    = "#0A1628"
NAVY_CARD    = "#0D1B2E"
NAVY_SURFACE = "#112238"
```

No yellow/amber accent at all — instead a 6-color category-accent palette
(red/orange/cyan/violet/pink/blue) for marketplace category icons.

These are genuinely different values, not rounding. I traced the current
in-repo tokens' history earlier this session: they were reconstructed by a
prior agent pass from a photo (`docs/TODO-BRAND-ASSETS.md`), not sourced from
this export. Given this file's explicit "locked" comment and that it's an
actual design-system export rather than a reconstruction, **I'd treat this
as the more authoritative source and update `packages/ui/src/brand/tokens.ts`
to match it** — but I'm asking rather than just doing it, since it touches
every screen that references `DRIPPLEX_BRAND.colors`.

Typography and radius tokens, by contrast, already match exactly what was
inventoried before (Poppins/Inter, base-8 spacing) — no conflict there.

### 1.2 The wordmark itself conflicts between two things you've sent me

- **`Dripplex_brand_id.png`** (in this export, a formal brand-identity
  reference sheet, mark on white): wordmark reads **"Dripplex"** — capital D
  only, lowercase rest including the final "x", single navy color. This
  matches what's currently implemented in the repo today.
- **The black-background lockup photos you sent earlier this conversation**:
  wordmark reads **"DrippleX"** — capital X, colored green, "Dripple" in
  white.

Both are things you told me were approved. I'm not picking one — tell me
which is right, or whether they're intentionally different treatments for
different contexts (e.g. formal brand sheet vs. in-app dark-UI lockup).

One thing resolved either way: the mark itself (the swoosh/motion-line "D")
is consistent across every image you've sent, and this export's brand sheet
confirms **it does sit directly on white**, not just inside a fixed black
plate — that earlier open question is settled.

## 2. RIDE-003: this is an updated version of what's already built, not new

`docs/reference/rideScreen-figma-make-source.tsx` (3,339 lines, used to build
the already-shipped RIDE-003 slices 1–4) and this export's `rideScreen.tsx`
(2,873 lines) are **different files**, confirmed via diff, not identical.
Screen-level diff:

- **New in this version:** `CashPaymentScreen`, `OPayPaymentScreen`,
  `PickupConfirmScreen`, `RideDetailScreen`, `RideHomeExtendedScreen`
- Everything else present in both — same screen set otherwise

This needs a proper side-by-side reconciliation against what's actually
live in `apps/customer-web/src/app/(customer)/ride/*` before any code
changes — not assumed to be a strict superset. Not done yet.

**Important caveat on `RIDE-003-INTEGRATION-MAP-figma-make-draft.md`**
(included in this export, preserved under the same reference folder): it
proposes a fictional backend contract (`wss://api.dripplexapp.com/ws`,
generic `/ride/trips` REST paths, its own `RideStatus` enum, its own
`useRide`/`useRideTracking`/etc. hooks). **This does not match the real,
already-built DrippleX backend** — real ride endpoints, the real WebSocket
gateway (built in RIDE-002.5), and real SDK methods already exist and are
already wired into the shipped RIDE-003 UI. This document is Figma Make's
own generic guess at an API shape, written without visibility into the
actual backend — file name kept as `-figma-make-draft` specifically so it's
never mistaken for the real contract. The real integration reference is this
repo's own `RIDE-002.5`–`RIDE-002.9` docs and the actual controller/gateway
code.

## 3. Scope — still not answered, now more consequential

I asked directly (twice in prose, once via a structured question you
dismissed) whether this full super-app vision is meant to be built now or
after Ride ships. That question stands, and matters more now that I can see
concretely how much real, substantial design material exists for
Marketplace/Wallet/Driver/Admin/Auth beyond Ride — this isn't a vague
mockup, it's ~14,000 lines of real component code for verticals beyond Ride.
I have not started implementing any of it.

## 4. What's preserved, nothing implemented yet

All under `docs/reference/figma-super-app-source/`:

- `tokens/*.ts` — the real, complete design token system
- `dripplex-brand-identity.png` — the formal brand reference
- `rideScreen-v2.tsx`, `homeScreen.tsx`, `walletScreen.tsx`,
  `driverScreen.tsx`, `adminConsoleScreen.tsx`, `marketplaceScreen.tsx`,
  `storeScreen.tsx`, `productDetailScreen.tsx`, `cartScreen.tsx`,
  `checkoutScreen.tsx`, `trackingScreen.tsx`, `screensA–D.tsx` (Auth),
  `shared.tsx`, `App.tsx`
- `RIDE-003-INTEGRATION-MAP-figma-make-draft.md` — kept for the design
  constraints section (§11 of that doc: locked colors/fonts/radius/timing),
  not for its invented backend contract (§2 above)

No application code has been changed as a result of this inventory.
