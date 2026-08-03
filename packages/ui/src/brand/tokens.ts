/**
 * Official Dripplex Brand Identity — single source of truth for hex values.
 * Locked from the founder's approved Figma Make export
 * (`docs/reference/figma-super-app-source/tokens/colors.ts`,
 * `DrippleX_Super_App_Design_Copy.zip`, 2026-08-03) — see
 * `docs/FIGMA-SOURCE-INVENTORY-V2.md`. CSS tokens in globals.css must stay
 * in sync with these constants.
 *
 * Tagline: life, Simplified (exact capitalization and punctuation)
 *
 * `colors` keeps the pre-existing primary/secondary/accent/neutral/white
 * shape for the small set of internal consumers, mapped onto the real
 * locked token names (see `../tokens/colors.ts` for the full palette,
 * including the navy scale and category-accent colors this simplified
 * shape can't represent):
 *   primary  -> BRAND_GREEN_MID  (locked "primary brand green")
 *   secondary -> NAVY_BASE       (locked "screen base layer")
 *   accent   -> BRAND_GREEN_LIGHT (locked "highlight / text on dark" —
 *               the locked palette has no yellow/amber accent anymore)
 *   neutral  -> NAVY_SURFACE     (locked "elevated surface / input bg" —
 *               the locked design is dark-first, so "neutral surface" is
 *               now a dark navy tone, not a light gray)
 */
export const DRIPPLEX_BRAND = {
  name: 'Dripplex',
  tagline: 'life, Simplified',
  colors: {
    primary: '#2BAC52',
    secondary: '#0A1628',
    accent: '#47CF72',
    neutral: '#112238',
    white: '#FFFFFF',
  },
} as const;

export type DripplexBrandColors = typeof DRIPPLEX_BRAND.colors;
