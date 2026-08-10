// DrippleX Typography System

export const FONT_HEADING = "'Poppins', sans-serif";
export const FONT_BODY = "'Inter', sans-serif";

// Type scale in px — use with style={{ fontSize: TYPE.md }}
export const TYPE = {
  '2xs': 9,
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  lg: 14,
  xl: 15,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  '5xl': 24,
  '6xl': 28,
  '7xl': 32,
} as const;

export const WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const LINE = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;
