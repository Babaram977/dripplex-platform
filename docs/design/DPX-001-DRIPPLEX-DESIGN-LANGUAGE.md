# DPX-001 — DrippleX Design Language (stub)

**Status: outline only, no code changes.** This document exists to record
the folder structure the founder sketched for a future platform-wide
design language, and to log the one real conflict already found. It does
not restructure anything, does not move any existing doc, and does not
block RIDE-003 Slice 4. Nothing under `docs/design/` or `docs/DDS-002-*`
changes as a result of this file.

## Why this exists now, but only as a stub

After RIDE-003A (the Ride-scoped design lock, `DDS-002-RIDE-DESIGN-SYSTEM.md`

- `DDS-002-RIDE-UI-KIT.md`), the founder asked whether that discipline
  should extend platform-wide, into a single `DPX-001` covering Foundations,
  Components, and every module (Ride, Delivery, Marketplace, Wallet,
  Merchant, Driver, Admin).

Doing that for real means reconciling two design systems that already
ship in production, not writing one from scratch:

- **Ride** (`apps/customer-web/src/components/ride/`): dark theme,
  `#060E1C`/`#0A1628` backgrounds, Poppins/Inter, documented in DDS-002.
- **Everything else** (Delivery, Marketplace, Wallet, Merchant, Admin):
  light theme, `DRIPPLEX_BRAND` tokens, already shipped and in active use.

Those are not two skins of one system — they're two different color
directions, and unifying them is a real design decision, not a
documentation exercise. Per the founder's decision (2026-08-02): stub the
outline now, reconcile later as its own initiative, and don't let it gate
Slice 4.

## Planned structure (not yet populated)

```
docs/design/
  DPX-001-DRIPPLEX-DESIGN-LANGUAGE.md   (this file — outline only)
  foundations/
    colors.md
    typography.md
    spacing.md
    radius.md
    elevation.md
  components/
    button.md
    card.md
    bottom-sheet.md
    search.md
    input.md
    badge.md
    navigation.md
  ride/          -> DDS-002-RIDE-DESIGN-SYSTEM.md + DDS-002-RIDE-UI-KIT.md (already written)
  delivery/      -> not started
  marketplace/   -> not started
  wallet/        -> not started
  merchant/      -> not started
  driver/        -> not started
  admin/         -> not started
```

None of the above subdirectories or files exist yet. `ride/` is listed
only to show where the already-complete DDS-002 pair would slot in if
this structure is ever adopted — those two files stay exactly where they
are (`docs/design/DDS-002-RIDE-DESIGN-SYSTEM.md`,
`docs/DDS-002-RIDE-UI-KIT.md`) until a real migration is decided.

## Open reconciliation item

Ride's dark theme vs. `DRIPPLEX_BRAND`'s light theme is a real,
unresolved conflict, not an oversight to quietly paper over in
Foundations. Two honest options exist once this work is actually taken
up, and picking between them is a founder decision, not one to make
implicitly by writing shared Foundations tokens that quietly favor one
side:

1. Ride's dark theme is a deliberate, permanent exception (ride-hailing
   surfaces commonly go dark for map/night-driving legibility) — in which
   case `foundations/colors.md` documents two theme tracks, not one.
2. Ride is meant to eventually reconcile toward `DRIPPLEX_BRAND` (or vice
   versa) — in which case that's a visual migration on par with RIDE-003
   itself, scoped and sequenced on its own, not something to fold into
   finishing Slice 4.

## Non-goals of this stub

- No existing file moves.
- No existing token, component, or screen changes.
- Does not block or slow RIDE-003 Slice 4, which continues to compose
  strictly from the already-frozen `ride-ui.tsx` primitives per DDS-002.
- Not a commitment to a timeline for when this becomes a real,
  populated document — that's a separate decision when the founder wants
  to take up the reconciliation question above.
