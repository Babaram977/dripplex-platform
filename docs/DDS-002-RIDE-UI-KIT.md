# DDS-002 — DrippleX Ride UI Kit

Component-level reference — for the token-level system (colors, spacing,
radius, shadows, gradients, animation timing, all extracted and audited
against every Ride screen) see
`docs/design/DDS-002-RIDE-DESIGN-SYSTEM.md`. The two together are DDS-002:
this file catalogs the frozen components, that one catalogs the raw
design tokens they're built from.

A code document, not a design document: this is a human-readable catalog
of every primitive already implemented in
`apps/customer-web/src/components/ride/ride-ui.tsx`. **The code is the
source of truth, not this file** — every value below was read directly out
of that file, not decided independently. If they ever disagree, the code
wins and this doc is stale and needs regenerating.

Purpose: every Ride screen — real, ported, or generated — assembles these
primitives instead of hand-rolling card/button/sheet markup. That's what
keeps 31 screens feeling like one product built by one designer on one
day, per the founder's Visual Lock rule (2026-08-02): Claude implements,
never redesigns; a generated screen must be indistinguishable from a
received one.

## Design tokens (used throughout, not re-declared per primitive)

| Token             | Value                                                                                                                | Used for                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background (deep) | `#060E1C`                                                                                                            | full-screen backdrop on hero/map screens                                                                                                                            |
| Background (base) | `#0A1628`                                                                                                            | full-screen backdrop on list/form screens, bottom sheets                                                                                                            |
| Card              | `#0D1B2E`                                                                                                            | `MapCanvas` fill                                                                                                                                                    |
| Surface           | `#112238`                                                                                                            | cards, chips, inputs, secondary buttons                                                                                                                             |
| Primary green     | `#2BAC52`                                                                                                            | icons, active states, map markers                                                                                                                                   |
| Green dark        | `#176B30`                                                                                                            | gradient start (`ActionButton` primary)                                                                                                                             |
| Green light       | `#47CF72`                                                                                                            | gradient end, success text, active accents                                                                                                                          |
| Border (default)  | `rgba(255,255,255,.08)`                                                                                              | every card/surface border                                                                                                                                           |
| Text (muted)      | `rgba(255,255,255,.5)` (raised from `.38` post-Slice-4 for WCAG AA contrast — see DDS-002-RIDE-DESIGN-SYSTEM.md §10) | secondary/help text                                                                                                                                                 |
| Text (dim)        | `rgba(255,255,255,.6)`                                                                                               | body text on dark surfaces                                                                                                                                          |
| Danger            | `#EF4444`                                                                                                            | destructive actions, error states                                                                                                                                   |
| Danger surface    | `rgba(239,68,68,.08)` / border `rgba(239,68,68,.2)`                                                                  | danger button/banner backgrounds                                                                                                                                    |
| Warning           | `#F59E0B` (surface `rgba(245,158,11,.12)`)                                                                           | "free cancellation" note, cash-payment accent — real, found in a later audit pass                                                                                   |
| Selection tint    | `rgba(34,197,94,.06–.15)`                                                                                            | "this option is selected" backgrounds (payment method, report category, promo) — a distinct green from the brand-green tint above, real and sourced from Figma Make |
| Heading font      | `'Poppins', sans-serif`                                                                                              | all bold/emphasis text — loaded via `(ride)/ride/layout.tsx`, not the app root                                                                                      |
| Body font         | `'Inter', sans-serif`                                                                                                | all regular text — same scoped load                                                                                                                                 |

## Primitives

### `RideStatusBar`

Fixed mock-clock row at the top of every screen. `px-5 pt-[52px]`, 11px
Inter, `rgba(255,255,255,.55)`.

### `BackArrow`

40×40 (`h-10 w-10`), `rounded-2xl`, background `rgba(255,255,255,.06)`,
border `rgba(255,255,255,.08)`, `active:scale-95`. 20×20 stroke icon,
`rgba(255,255,255,.7)`.

### `SafetyChip`

Pill, `px-3 py-1.5`, background `rgba(43,172,82,.12)`, border
`rgba(43,172,82,.2)`. Label: 11px Inter, `600` weight, `#47CF72`.

### `RideHeader`

Composes `RideStatusBar` + optional `BackArrow` + optional title (17px
Poppins bold, white) + optional right slot. `floating` prop switches
between `relative` (solid header) and `absolute inset-x-0 top-0`
(transparent, over a map/hero).

### `ActionButton`

Full-width primary CTA. `h-14`, `rounded-2xl`, 15px Poppins semibold,
`active:scale-[.97]`. Three variants:

- `primary` (default): gradient `135deg,#176B30 0%,#2BAC52 52%,#47CF72 100%`, shadow `0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)`, white text.
- `secondary`: surface `#112238`, border `rgba(255,255,255,.08)`, text `rgba(255,255,255,.8)`.
- `danger`: surface `rgba(239,68,68,.08)`, border `rgba(239,68,68,.2)`, text `#EF4444`.

Disabled/loading state (any variant): background `rgba(255,255,255,.06)`,
text `rgba(255,255,255,.22)`, no shadow, label replaced with "Please
wait…" when `loading`.

### `QuickActionButton`

Compact icon-over-label button for 2-4-button rows (Call/Chat/Cancel/
Share/SOS). `flex-1`, `rounded-2xl`, `py-2.5`, 16px icon, 11px Inter
label. `neutral` tone: surface `#112238`. `danger` tone: surface
`rgba(239,68,68,.08)`, text `#EF4444`. Auto-disables (`opacity-40`) when
no `onClick` is passed — used for capability-gap placeholders (Call,
Message, Share, SOS) rather than wiring an empty handler.

### `RideBottomSheet`

The card that hosts most screen content. Background `#0A1628`, top
corners `28px`, shadow `0 -24px 80px rgba(0,0,0,.7)`. `peek` adds the
10×1 drag-handle pill (`rgba(255,255,255,.15)`). `title` adds a 17px
Poppins bold heading. `anchored` fixes it to the bottom over a full-bleed
map instead of filling the remaining screen height.

### `StatusBanner`

Centered title/subtitle for state messages ("Finding your driver…",
"Driver found!", "No drivers available"). Title 20px Poppins bold; color
by `tone` — `neutral` white, `success` `#47CF72`, `error` `#EF4444`.
Subtitle (optional) 14px Inter, `rgba(255,255,255,.38)`.

### `ETAChip`

Small stat pill — value on top (13px Poppins bold, `#47CF72`), label
below (10px Inter, `rgba(255,255,255,.38)`). Surface `#112238`.

### `FareBreakdown`

Line-item card: base/distance/time rows (13px Inter) + divider
(`rgba(255,255,255,.08)`, 1px) + total row (14px/18px Poppins bold,
total value in `#47CF72`). Amounts formatted `₦{n.toLocaleString()}`.

### `DriverCard`

See its own doc comment in `ride-ui.tsx` for the capability-gap rationale.
Visual: 56×56 (`h-14 w-14`) icon tile (`rgba(43,172,82,.12)`, 🚗), 15px
Poppins bold "Your driver", 12px Inter muted status line. Surface
`#112238`. Renders as a `<button>` (tappable, opens `DriverProfileSheet`)
when `onViewProfile` is passed, otherwise a static `<div>`.

### `MapCanvas`

Decorative SVG route illustration — **not a real map** (see its doc
comment: no Maps SDK integration exists in this codebase). Fixed
390×320 viewBox, background `#0D1B2E`, faint grid lines
(`rgba(255,255,255,.07)`), route path in `rgba(43,172,82,.12–.25)`, pickup/
dropoff markers in `#2BAC52`/white. `variant` picks one of 4 fixed
coordinate sets (`default`/`finding`/`assigned`/`inprogress`); `progress`
(0-1) draws a solid `#2BAC52` overlay along the route for trip-in-progress
screens.

## Forbidden, per the Visual Lock rule

No primitive above uses a shadcn, Tailwind, HeroUI, Material, or Chakra
default color/spacing/radius token — every value is a literal hex/px/rgba
copied from the real source or (for generated screens) derived from a
named reference screen, recorded in
`docs/RIDE-003-GENERATED-SCREENS.md`. Extending this kit means adding a
new exported function here with the same sourcing discipline, not reaching
for a framework default.

## Adding a new primitive

1. Only when a real or generated screen genuinely needs one — don't build
   speculatively.
2. Every value must trace to either the real source
   (`docs/reference/rideScreen-figma-make-source.tsx`) or an explicit,
   documented derivation from an existing primitive/screen.
3. Add it to `ride-ui.tsx`, then add its entry here in the same commit —
   this doc is a reference, not a spec written ahead of the code.
