# Store & marketing assets (D4)

Official **production** raster assets are not yet available — see `docs/TODO-BRAND-ASSETS.md`. This directory holds **specifications and placeholders** until the brand kit lands.

## Required before store submission

| Asset                           | Google Play | App Store | PWA      |
| ------------------------------- | ----------- | --------- | -------- |
| App icon 512×512 PNG            | ✅          | —         | maskable |
| Feature graphic 1024×500        | ✅          | —         | —        |
| Phone screenshots 1080×1920 min | ✅          | ✅        | —        |
| Tablet screenshots              | optional    | ✅ iPad   | —        |
| App preview video               | —           | optional  | —        |
| Splash 2732×2732 (iOS)          | —           | ✅        | —        |
| Android adaptive icon layers    | ✅          | —         | —        |

## Palette (from brand identity)

- Primary: `#0E7A3E`
- Navy: `#0A2540`
- Accent: `#FFC107`
- Background: `#F4F6F8`

## Generation workflow

1. Commit official SVG from brand kit to `packages/ui/src/brand/assets/`.
2. Export PNG sets with `@capacitor/assets` or design tool:
   ```bash
   cd apps/customer-mobile
   npx @capacitor/assets generate --iconBackgroundColor '#0E7A3E' --splashBackgroundColor '#0E7A3E'
   ```
3. Place store screenshots under `store-assets/screenshots/{android,ios}/`.
4. Update listings in `docs/store/`.

## Placeholder status

Current launcher icons use Capacitor defaults tinted to brand green. **Replace before public store listing.**
