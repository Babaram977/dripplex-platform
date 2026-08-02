# DDS-002 — DrippleX Ride Design System

Per the founder's RIDE-003A design-lock instruction (2026-08-02). Every
value below was extracted directly from the codebase — `grep`'d out of
`apps/customer-web/src/components/ride/` and cross-checked against
`docs/reference/rideScreen-figma-make-source.tsx` (the real Figma Make
export) — not decided independently. **The code is still the source of
truth, not this file.** If they ever disagree, the code wins and this doc
is stale.

Source-of-truth priority, per the founder's ordering:

1. Real Figma Make exported screens (`docs/reference/rideScreen-figma-make-source.tsx`)
2. Existing approved Ride screens already implemented (Slices 1-3)
3. Shared primitives in `ride-ui.tsx`
4. Generated screens (`docs/RIDE-003-GENERATED-SCREENS.md`) — references, not a
   new visual language

Never a fifth style. Never a new hex value, radius, shadow, gradient, or
spacing unit invented from nothing — every generated screen derives from
the nearest real neighbor.

## 1. Colors

Every hex color that actually appears in Ride code (verified via `grep -rohE "#[0-9A-Fa-f]{6}" .`):

| Token             | Hex       | Used for                                               |
| ----------------- | --------- | ------------------------------------------------------ |
| Background (deep) | `#060E1C` | full-screen backdrop, hero/map screens                 |
| Background (base) | `#0A1628` | full-screen backdrop, list/form screens, bottom sheets |
| Card              | `#0D1B2E` | secondary card backgrounds, `MapCanvas` fill           |
| Surface           | `#112238` | cards, chips, inputs, secondary buttons                |
| Green dark        | `#176B30` | gradient start                                         |
| Primary green     | `#2BAC52` | icons, map markers, active accents, brand              |
| Green light       | `#47CF72` | gradient end, success text, active text                |
| Danger            | `#EF4444` | destructive actions, error states, drop-off pin        |
| Warning           | `#F59E0B` | "free cancellation" note, cash-payment accent          |

Every rgba color in active use (verified via `grep -rohE "rgba\(...\)" .`), grouped by role:

| Role                                 | Value(s)                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Border (default)                     | `rgba(255,255,255,.08)`                                                                                                                                                                                                                                                                                                                                                                                          |
| Text — full white                    | `#fff`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Text — dim                           | `rgba(255,255,255,.6)` / `.7` / `.8`                                                                                                                                                                                                                                                                                                                                                                             |
| Text — muted                         | `rgba(255,255,255,.5)` (raised from `.38` — see §9 Production Audit fix)                                                                                                                                                                                                                                                                                                                                         |
| Text — disabled                      | `rgba(255,255,255,.22)` / `.3`                                                                                                                                                                                                                                                                                                                                                                                   |
| Hairline / faint                     | `rgba(255,255,255,.06)` / `.07` / `.15` / `.5` / `.55`                                                                                                                                                                                                                                                                                                                                                           |
| Green tint (icon/status backgrounds) | `rgba(43,172,82,.08–.4)` — the brand-green family, used for icon tiles, chips, selected-state borders                                                                                                                                                                                                                                                                                                            |
| Green tint (selection background)    | `rgba(34,197,94,.06–.15)` — a **distinct** green from the brand family above, real and sourced from Figma Make (`PaymentScreen`, `ReportTripScreen`, `PromoCodeScreen`, `LiveTrackingScreen`'s LIVE badge). Kept as its own documented token, not merged into the brand-green tint — the real source consistently uses it specifically for "this option is selected" backgrounds, distinct from icon-tile tints. |
| Danger tint                          | `rgba(239,68,68,.08–.3)`                                                                                                                                                                                                                                                                                                                                                                                         |
| Warning tint                         | `rgba(245,158,11,.12)`                                                                                                                                                                                                                                                                                                                                                                                           |
| Map overlays                         | `rgba(10,22,40,.85)` / `.95)` (frosted header pills over the map)                                                                                                                                                                                                                                                                                                                                                |
| Shadow base                          | `rgba(0,0,0,.7)`                                                                                                                                                                                                                                                                                                                                                                                                 |

**No new hex value may be introduced.** If a screen needs a color not in
this table, check the real source first (Parts 1-3 of the reference file)
before generating anything.

## 2. Typography

Font families: **Poppins** (headings, prices, emphasis) / **Inter** (body,
labels, captions) — loaded via `apps/customer-web/src/app/(ride)/ride/layout.tsx`,
scoped to the Ride route only.

Font sizes actually in use (verified, `text-[Npx]` classes + inline `fontSize`):
`10px, 11px, 12px, 13px, 14px, 15px, 16px, 17px, 18px, 20px, 22px, 26px, 28px, 32px, 36px`.
No other sizes exist. Rough scale role:

| Size    | Typical role                                                   |
| ------- | -------------------------------------------------------------- |
| 10-11px | eyebrow labels, chip captions, status-bar clock                |
| 12-13px | secondary/meta text, form labels                               |
| 14-15px | body text, button labels, card titles                          |
| 16-18px | screen titles, section headings                                |
| 20-22px | emphasis numbers (fare totals, headline state text)            |
| 26-36px | hero numbers (trip-completed headline, payment success amount) |

Weights: Tailwind `font-medium` (500) / `font-semibold` (600) /
`font-bold` (700) / inline `fontWeight: 800`/`900` for the largest hero
numbers only (`FareEstimateScreen`'s promo, `WalletPaySuccessScreen`'s paid
amount).

Letter-spacing: only two real uses, both Tailwind `tracking-widest` /
`tracking-wide` on small uppercase eyebrow labels ("TRIP COMPLETED",
"Integration status"). Not used anywhere else — don't add it elsewhere
without a real reason.

Line-height: not customized anywhere — every screen relies on Tailwind's
default line-height for the given font-size utility. Documenting this
honestly rather than inventing specific numbers that were never actually
set.

## 3. Spacing

Real Tailwind spacing utilities in use span the standard 4px-based scale:
`0.5(2px), 1(4px), 1.5(6px), 2(8px), 2.5(10px), 3(12px), 3.5(14px), 4(16px),
5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 14(56px), 20(80px)`.

The founder's instruction asks for a restricted set — `4 8 12 16 20 24 32
40 48` — and per source-of-truth priority, **real Figma Make values
outrank an invented constraint list**: the half-steps (`1.5`/6px,
`2.5`/10px, `3.5`/14px) are not drift, they're copied verbatim from the
real source (e.g. `SafetyChip`'s `px-3 py-1.5`, `PassengerWaitingScreen`'s
`p-3.5`, chip gaps of `gap-1.5`/`gap-2.5`). Rewriting them to the nearest
"clean" 4-step value would mean deviating from the actual approved
screens to satisfy an idealized grid — the opposite of the lock's goal.
Flagged here explicitly rather than silently either breaking fidelity or
silently ignoring the instruction.

## 4. Radius

`rounded-xl` (12px), `rounded-2xl` (16px) — the default for nearly every
card/button/input, `rounded-3xl` (24px) — larger hero cards and avatar
tiles, `rounded-full` — pills, dots, avatars, `rounded-t-3xl` — anchored
bottom-sheet top corners (equivalent to `RideBottomSheet`'s inline
`borderRadius: '28px 28px 0 0'`, which is a real, deliberately-larger
value than the Tailwind `3xl` step, copied from the source). No other
radius values exist.

## 5. Shadows

Only three real `boxShadow` values in the entire Ride surface:

| Shadow         | Value                                                           | Used for                                          |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| Bottom sheet   | `0 -24px 80px rgba(0,0,0,.7)`                                   | every `RideBottomSheet`                           |
| Success glow   | `0 0 60px rgba(43,172,82,.35–.4)`                               | trip-completed icon, payment-success icon         |
| Primary button | `0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)` | `ActionButton` primary variant, active state only |

## 6. Gradients

Exactly two green gradients, both `135deg`:

- 3-stop: `#176B30 0% → #2BAC52 52% → #47CF72 100%` — `ActionButton` primary.
- 2-stop: `#176B30 → #2BAC52` — avatar/icon tiles, success icon circles.

Plus two fade overlays (map-to-sheet legibility gradients, not brand
gradients): `linear-gradient(to bottom, transparent 30–40%, rgba(10,22,40,.95) 70–100%)`.

No other gradient exists. Never invent a new stop order or angle.

## 7. Animation timing

Real, verified values — nothing here is estimated:

- Tap feedback: `active:scale-95` (icon buttons) / `active:scale-[.97]`
  (primary `ActionButton`), `transition-all` (no explicit duration — relies
  on Tailwind's default ~150ms), except the primary button which sets
  `duration-200` explicitly.
- Trip progress bar fill: `transition-all duration-[1200ms]` (real source's
  `RideInProgressScreen`), matched by the 1200ms interval driving the mock
  progress in the same screen.
- "Finding your driver…" dot cycle: 500ms interval.
- No other custom timing exists anywhere in the Ride surface — no
  page-transition/fade/slide system beyond what Next.js/React provide by
  default. If Slice 4 needs a screen-transition animation, check whether
  the real source specifies one before inventing timing.

## 8. Frozen components (`ride-ui.tsx`)

`RideStatusBar`, `BackArrow`, `SafetyChip`, `RideHeader`, `ActionButton`,
`QuickActionButton`, `RideBottomSheet`, `StatusBanner`, `ETAChip`,
`FareBreakdown`, `DriverCard`, `MapCanvas`. Full spec for each (exact
height/padding/color/state) already documented per-component in
`docs/DDS-002-RIDE-UI-KIT.md` — that file remains the component-level
reference; this file is the token-level one. Everything new reuses these;
a new component is only added when a real or generated screen genuinely
needs one, with the same code-sourcing discipline.

## 9. Audit result (this pass)

Ran a real audit — `grep`-extracted every color/radius/shadow/spacing/
gradient/font-size actually used across every Ride file, not assumed —
before writing this document. Findings:

1. **`#F59E0B` (warning) and the `rgba(34,197,94,*)` selection-tint family
   were real and in use but undocumented** in the earlier
   `DDS-002-RIDE-UI-KIT.md` token table. Both are genuine, sourced from
   the real Figma Make export — fixed here, not a code change.
2. **`docs/reference/rideScreen-figma-make-source.tsx` was incomplete** —
   Parts 2 and 3 had been replaced with placeholder comments instead of
   the actual verbatim source, undermining exactly this kind of audit.
   Fixed: the file now contains the full verbatim source received in chat.
3. **One real typography deviation found and fixed**:
   `TipDriverScreen`'s driver-initial avatar circle used Tailwind's
   `text-lg` (18px) where the real source explicitly set `fontSize: 16`
   for that exact element — a 2px drift introduced while porting.
   Corrected to `text-[16px]` to match exactly. Checked every other
   non-bracket Tailwind text-size class (`text-sm`/`text-base`/`text-lg`/
   `text-2xl`/`text-3xl`) used across the Ride surface against the real
   source line-by-line; all others matched exactly (icon-tile sizing on
   `RideHomeScreen`, `DestinationSearchScreen`, `TipDriverScreen`'s preset
   pills, `RateDriverScreen`'s avatar, `DriverCard`'s icon).
4. **No other code-level violations found** — no screen introduces a hex
   color, radius, shadow, or gradient outside what's cataloged above. The
   only spacing "violations" relative to the founder's proposed
   4/8/12/16/20/24/32/40/48 grid are half-step values that are themselves
   real, sourced from Figma Make (see Section 3) — not drift to fix, but
   real design decisions from the source to keep.

## 10. Production Audit fix (post-Slice-4)

`docs/RIDE-003-PRODUCTION-AUDIT.md` computed real WCAG contrast ratios for
every text token against both real backgrounds and found the "muted" token
(`rgba(255,255,255,.38)`) failed AA's 4.5:1 minimum for normal text —
**3.57:1** against `#0A1628`, **3.47:1** against `#112238`. This is the one
place this document's own value has changed since the RIDE-003A lock: the
opacity was raised to `.5`, computed to clear 4.5:1 against both real
backgrounds (4.58:1 against `#112238`, the tighter constraint; 4.78:1
against `#0A1628`). Applied everywhere the token was used — `ride-ui.tsx`
and all 16 screen files that referenced it — via a single mechanical
find-and-replace, not a per-screen judgment call. No other token in this
document changed.
