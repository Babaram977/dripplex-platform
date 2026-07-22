/**
 * Official Dripplex Brand Identity — single source of truth for hex values.
 * CSS tokens in globals.css must stay in sync with these constants.
 *
 * Tagline: life,Simplified (exact capitalization and punctuation)
 */
export const DRIPPLEX_BRAND = {
  name: 'Dripplex',
  tagline: 'life,Simplified',
  colors: {
    primary: '#0E7A3E', // Emerald Green
    secondary: '#0A2540', // Deep Navy
    accent: '#FFC107', // Sunshine Yellow
    neutral: '#F4F6F8', // Light Gray
    white: '#FFFFFF',
  },
} as const;

export type DripplexBrandColors = typeof DRIPPLEX_BRAND.colors;
