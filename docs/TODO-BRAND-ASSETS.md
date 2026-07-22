# Brand follow-ups

## Open

### TODO(brand-assets) — replace placeholder logo with official vector

> **RC1 branding blocker (only):** Official brand assets are unavailable. Palette-compliant SVG placeholders ship for favicon / app icon / PWA. This does **not** block staging functional approval; it blocks final brand-polished GA.

- **Why:** PR #23 brand mark was reconstructed from the official palette for compliance. Production branding requires the official SVG/AI/PDF asset.
- **Do:**
  1. Commit official vectors under `packages/ui/src/brand/assets/`.
  2. Point `dripplexMarkSvg` at the official SVG.
  3. Update `apps/customer-web/public/favicon.svg` and `app-icon.svg` (and portal copies).
  4. Add PNG apple-touch / splash / maskable set for PWA install polish.
  5. Visual QA on light/dark auth, nav, empty states.
- **Refs:** `docs/BRAND-IDENTITY.md` § Logo assets · `packages/ui/src/brand/dripplex-mark.ts` · `docs/RELEASE-RC1.md` KI-01

## Done

- [x] Tagline corrected to `life, Simplified` (space after comma) everywhere.
- [x] RC1 PWA manifest + portal icon metadata wired (placeholder SVGs).
