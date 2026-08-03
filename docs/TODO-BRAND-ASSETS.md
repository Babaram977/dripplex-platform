# Brand follow-ups

## Open

### Favicons / app-icons / PWA assets still point at the old placeholder

The palette-only placeholder mark is gone (see Done below), but
`apps/*/public/favicon.svg`, `app-icon.svg`, and PWA
apple-touch/splash/maskable icons across customer-web, driver-portal,
admin-portal (and portal copies) still reference the pre-2026-08-03
placeholder and haven't been regenerated from the new traced mark yet.

- **Do:**
  1. Export the new `dripplexMarkSvg` (`packages/ui/src/brand/dripplex-mark.ts`) to static SVG/PNG files per app's `public/` folder.
  2. Regenerate PNG apple-touch/splash/maskable set for PWA install polish.
  3. Visual QA across light/dark auth, nav, empty states, and the still-open light-vs-dark-default question (see `packages/ui/src/styles/globals.css` header comment).
- **Refs:** `docs/FIGMA-SOURCE-INVENTORY-V2.md` · `packages/ui/src/brand/dripplex-mark.ts` · `docs/RELEASE-RC1.md` KI-01

### True vector source still not in the repo

The mark is now traced from real pixels (OpenCV contour detection on the
approved brand-identity PNG) rather than guessed from a compressed photo,
but it's still a raster-traced polygon approximation with straight edges,
not the original bezier vector paths — corners read slightly more angular
than the source's fully rounded pill-caps. If the founder ever has the
actual SVG/AI/PDF export (not just the PNG), swapping it in would close
that last gap.

## Done

- [x] Tagline corrected to `life, Simplified` (space after comma) everywhere.
- [x] RC1 PWA manifest + portal icon metadata wired (placeholder SVGs).
- [x] **2026-08-03:** Replaced the palette-only placeholder mark with a real
      trace of the founder's approved brand-identity export
      (`docs/reference/figma-super-app-source/dripplex-brand-identity.png`,
      from `DrippleX_Super_App_Design_Copy.zip`) — see
      `docs/FIGMA-SOURCE-INVENTORY-V2.md`. Colors, spacing, typography,
      radius, and animation tokens also ported from that export's locked
      `src/tokens/*.ts` into `packages/ui/src/tokens/`.
