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
/** Bottom-nav padding that clears the device's own gesture area.
 *
 * This was the number 24 — a guess at an iPhone home indicator, applied
 * identically to a device that has none. Now it is the real inset with 24 as
 * the floor, so the bar sits above the home indicator on an iPhone and above
 * Android's gesture pill on a phone that uses one, and is unchanged on a
 * device with neither. `env()` only reports a real value because index.html
 * now sets `viewport-fit=cover`.
 *
 * A string, not a number, so it must be spread into a `style` — the numeric
 * export could be used in arithmetic and this cannot. `BOTTOM_NAV_H` stays
 * numeric on purpose: it is used to reserve scroll space, where a fixed
 * conservative height is what callers want. */
export const BOTTOM_NAV_PB = 'max(env(safe-area-inset-bottom), 24px)';
export const FAB_BOTTOM = 94; // floating action button bottom offset
export const PHONE_W = 390;
export const PHONE_H = 844;
