# Native brand assets — source of truth

`dripplex-mark.svg` is the **master**. Every launcher icon, store icon and splash
image under `android/` and `ios/` is generated from it by
`scripts/generate-icons.mjs`. Nothing in those directories is hand-edited — if an
asset looks wrong, fix the master or the generator, never the PNG.

```
pnpm --filter @dripplex/customer-mobile icons:generate   # rewrite every asset
pnpm --filter @dripplex/customer-mobile icons:verify     # assert they are correct
```

## Provenance

Supplied by the founder 2026-08-21 as `dripplex-d-mark-black-background.svg` and
committed verbatim. It replaces the stock Capacitor logo, which was still
shipping in every launcher icon and splash screen up to this commit.

## Two properties that are deliberate, not defects

**The gradient resolves per path.** `<g fill="url(#dripplexGreen)">` uses the
default `objectBoundingBox` units, so each path runs the full `#62FF00 → #0B7A2B`
ramp across its own bounding box rather than one ramp sweeping the whole mark —
the dot alone goes `#2FCC1E → #0D812B` across 100px. That is how the approved
artwork looks and it is preserved on purpose. Founder decision 2026-08-21:
"preserving that appearance is more important than correcting it mathematically."
Switching to `userSpaceOnUse` would change the approved look and is a separate
brand decision.

**The paths are polygons, not Béziers.** All three use only `M`/`L`/`Z` — 18, 23
and 98 points. It is a fine raster trace, and faceting is invisible at 1024px and
below, which covers every asset generated here. It is _not_ suitable for
large-format print, signage or vehicle livery; those want a true Bézier redraw,
tracked separately in `docs/TODO-BRAND-ASSETS.md`.
