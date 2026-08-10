// DrippleX Elevation / Shadow tokens

export const ELEVATION = {
  none: 'none',
  xs: '0 1px 4px rgba(0,0,0,.18)',
  sm: '0 2px 8px rgba(0,0,0,.22)',
  md: '0 4px 16px rgba(0,0,0,.28)',
  lg: '0 8px 32px rgba(0,0,0,.38)',
  xl: '0 12px 48px rgba(0,0,0,.48)',

  // Brand-tinted shadows
  brand: '0 6px 24px rgba(43,172,82,.28)',
  brandLg: '0 10px 40px rgba(43,172,82,.38)',
  brandXl: '0 16px 60px rgba(43,172,82,.48)',

  // Component-specific
  card: '0 4px 20px rgba(0,0,0,.28)',
  sheet: '0 -20px 60px rgba(0,0,0,.5)',
  fab: '0 6px 28px rgba(43,172,82,.5)',
  nav: '0 -1px 0 rgba(255,255,255,.06)',
} as const;
