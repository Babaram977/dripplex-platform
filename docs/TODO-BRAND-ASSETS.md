# Brand follow-ups

## Open

### TODO(brand-assets) — replace placeholder logo with official vector

- **Why:** PR #23 brand mark was reconstructed from the official palette for compliance. Production branding requires the official SVG/AI/PDF asset.
- **Do:**
  1. Commit official vectors under `packages/ui/src/brand/assets/`.
  2. Point `dripplexMarkSvg` at the official SVG.
  3. Update `apps/customer-web/public/favicon.svg` and `app-icon.svg`.
  4. Visual QA on light/dark auth, nav, empty states.
- **Refs:** `docs/BRAND-IDENTITY.md` § Logo assets · `packages/ui/src/brand/dripplex-mark.ts`

## Done

- [x] Tagline corrected to `life, Simplified` (space after comma) everywhere.
