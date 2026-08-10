// DrippleX Spacing — base-8 scale in px

export const SPACE = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// Semantic layout constants
export const PAGE_H_PADDING = 20; // horizontal screen edge padding
export const CARD_PADDING = 16; // default card inner padding
export const SECTION_GAP = 24; // vertical gap between page sections
export const ITEM_GAP = 12; // gap between list / grid items
export const CHIP_GAP = 8; // gap between horizontal chips

// Device / frame constants
export const STATUS_BAR_H = 52; // top offset below dynamic island
export const BOTTOM_NAV_H = 72; // bottom nav total height (incl. safe area)
export const BOTTOM_NAV_PB = 24; // bottom nav safe-area padding-bottom
export const FAB_BOTTOM = 94; // floating action button bottom offset
export const PHONE_W = 390;
export const PHONE_H = 844;
