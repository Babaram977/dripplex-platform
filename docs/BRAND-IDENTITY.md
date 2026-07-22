# Dripplex Brand Identity Compliance

| Field        | Value                         |
| ------------ | ----------------------------- |
| **Status**   | Implemented in `@dripplex/ui` |
| **Tagline**  | `life,Simplified` (exact)     |
| **Baseline** | Program B brand compliance    |

## Official colours

| Role               | Name            | Hex       | Token                                 |
| ------------------ | --------------- | --------- | ------------------------------------- |
| Primary            | Emerald Green   | `#0E7A3E` | `--primary` / `--brand` / `--success` |
| Secondary          | Deep Navy       | `#0A2540` | `--secondary` / `--brand-navy`        |
| Accent / Promotion | Sunshine Yellow | `#FFC107` | `--accent` / `--promotion`            |
| Neutral            | Light Gray      | `#F4F6F8` | `--background` (light)                |
| White              | White           | `#FFFFFF` | `--card` / `--dripplex-white`         |

Source of truth: `packages/ui/src/brand/tokens.ts` + `packages/ui/src/styles/globals.css`.

## Buttons

| Variant                | Colour          |
| ---------------------- | --------------- |
| `default` (primary)    | Emerald         |
| `secondary`            | Deep Navy       |
| `success`              | Emerald         |
| `accent` / `promotion` | Sunshine Yellow |

## Typography

Display / sans continue via `--font-display` (Sora) and `--font-sans` (Manrope) as established in Customer Web. Do not introduce alternate stacks in feature code; FPX-002 may lock final type specimens when the brand guide PDF is ingested.

## Assets

| Asset              | Location                                               |
| ------------------ | ------------------------------------------------------ |
| Brand mark SVG     | `packages/ui/src/brand/dripplex-mark.ts`               |
| Logo component     | `DripplexLogo` / `DripplexTagline`                     |
| Favicon / app icon | `apps/customer-web/public/favicon.svg`, `app-icon.svg` |

## Rules

- No hardcoded brand hex in feature screens — use CSS variables / Tailwind tokens.
- No duplicate logo implementations — use `DripplexLogo` from `@dripplex/ui`.
- Dark mode retains structure; palette adapted from official colours.
- Layout, spacing, routes, and backend are unchanged (brand-only).
