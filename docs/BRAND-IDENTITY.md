# Dripplex Brand Identity Compliance

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| **Status**   | Implemented in `@dripplex/ui`                      |
| **Tagline**  | `life, Simplified` (exact — space after the comma) |
| **Baseline** | Program B brand compliance                         |

## Official colours

| Role               | Name            | Hex       | Token                                 |
| ------------------ | --------------- | --------- | ------------------------------------- |
| Primary            | Emerald Green   | `#0E7A3E` | `--primary` / `--brand` / `--success` |
| Secondary          | Deep Navy       | `#0A2540` | `--secondary` / `--brand-navy`        |
| Accent / Promotion | Sunshine Yellow | `#FFC107` | `--accent` / `--promotion`            |
| Neutral            | Light Gray      | `#F4F6F8` | `--background` (light)                |
| White              | White           | `#FFFFFF` | `--card` / `--dripplex-white`         |

Source of truth: `packages/ui/src/brand/tokens.ts` + `packages/ui/src/styles/globals.css`.

## Tagline

**Approved standard:** `life, Simplified`

- Exact capitalization
- **Space after the comma**
- Use `DRIPPLEX_BRAND.tagline`, `siteConfig.tagline`, or `<DripplexTagline />` — do not hardcode variants

## Logo assets

### Current status: temporary placeholder

The mark in `packages/ui/src/brand/dripplex-mark.ts` (and mirrored favicon/app-icon SVGs) was **reconstructed from the official colour palette**. It is **not** the production brand logo.

### TODO (required before treating branding as final)

- [ ] **TODO(brand-assets):** Commit the official Dripplex vector logo (SVG preferred; AI/PDF source optional) under `packages/ui/src/brand/assets/`.
- [ ] Replace `dripplexMarkSvg` with the official SVG export.
- [ ] Replace `apps/customer-web/public/favicon.svg` and `app-icon.svg` with official exports.
- [ ] Verify `DripplexLogo` sizing/contrast on light and dark surfaces after swap.

Until that swap lands, treat the current mark as a **placeholder only**.

## Buttons

| Variant                | Colour          |
| ---------------------- | --------------- |
| `default` (primary)    | Emerald         |
| `secondary`            | Deep Navy       |
| `success`              | Emerald         |
| `accent` / `promotion` | Sunshine Yellow |

## Typography

Display / sans continue via `--font-display` (Sora) and `--font-sans` (Manrope) as established in Customer Web. Do not introduce alternate stacks in feature code; FPX-002 may lock final type specimens when the brand guide PDF is ingested.

## Assets map

| Asset              | Location                                 | Status             |
| ------------------ | ---------------------------------------- | ------------------ |
| Brand mark         | `packages/ui/src/brand/dripplex-mark.ts` | Placeholder        |
| Logo component     | `DripplexLogo` / `DripplexTagline`       | OK (consumes mark) |
| Favicon / app icon | `apps/customer-web/public/*.svg`         | Placeholder        |

## Rules

- No hardcoded brand hex in feature screens — use CSS variables / Tailwind tokens.
- No duplicate logo implementations — use `DripplexLogo` from `@dripplex/ui`.
- Dark mode retains structure; palette adapted from official colours.
- Layout, spacing, routes, and backend are unchanged (brand-only).
