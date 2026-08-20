import React from 'react';

/**
 * The DrippleX icon set.
 *
 * The app inherited its tile icons from the Figma Make export, which uses
 * emoji — 🛍 for Marketplace, 🚖 for Ride, 🏪 for a merchant without a photo.
 * Emoji are bitmap glyphs supplied by the operating system, and that costs the
 * app three things at once:
 *
 *   - They blur. A colour-emoji font ships fixed-size bitmaps; at 24–28px on a
 *     3x phone screen the renderer is upscaling a raster, next to type and
 *     chrome SVG that are resolution-independent. It is the single loudest
 *     reason the app reads as less sharp than Talabat or Jumia Food.
 *   - They ignore the design. A tile passes `color` for its ring and glow, and
 *     the emoji inside it stays whatever colour Apple or Google painted it —
 *     so the green Marketplace tile holds a red-and-brown bag.
 *   - They are a different drawing on every device. Noto, Apple Color Emoji
 *     and Segoe each draw 🛒 in their own style, so no two customers see the
 *     same app.
 *
 * These are drawn on a 24 grid, unfilled, `currentColor`, 1.8 stroke with
 * round caps and joins — the idiom the app's existing chrome icons already
 * use, so a category tile and a back arrow finally look like they came from
 * the same hand. Because they take `currentColor`, a tile's own accent now
 * reaches its icon.
 *
 * This is deliberately a small, hand-drawn set rather than an icon-font
 * dependency: it is the icons this product actually names, it adds no network
 * request, and it keeps every glyph on one grid and one stroke weight.
 */

export type IconName =
  // Home quick actions
  | 'marketplace'
  | 'ride'
  | 'wallet'
  | 'orders'
  | 'utilities'
  | 'food'
  | 'health'
  | 'more'
  // Categories
  | 'supermarket'
  | 'restaurant'
  | 'pharmacy'
  | 'fashion'
  | 'electronics'
  | 'beauty'
  | 'home'
  | 'hardware'
  | 'hotel'
  | 'services'
  // Utilities
  | 'airtime'
  | 'data'
  | 'electricity'
  | 'cableTv'
  | 'store'
  | 'all'
  // Order tracking
  | 'scooter'
  | 'house';

/**
 * Path data only — the wrapping <svg> and its stroke attributes live in
 * <Icon>, so every glyph is guaranteed the same weight, grid and line joins.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  // A shopping bag: the marketplace itself.
  marketplace: (
    <>
      <path d="M4.5 8h15l-1.1 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8Z" />
      <path d="M8.75 8V6.5a3.25 3.25 0 0 1 6.5 0V8" />
    </>
  ),
  // A saloon car, three-quarter silhouette.
  ride: (
    <>
      <path d="M3.5 16.5v-3l1.9-4.2A2 2 0 0 1 7.2 8h9.6a2 2 0 0 1 1.8 1.3l1.9 4.2v3" />
      <path d="M3.5 13.5h17" />
      <circle cx="7.5" cy="16.5" r="1.75" />
      <circle cx="16.5" cy="16.5" r="1.75" />
      <path d="M9.25 16.5h5.5" />
    </>
  ),
  // A card wallet with a clasp.
  wallet: (
    <>
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h11a2 2 0 0 1 2 2v.5" />
      <path d="M3.5 8.5v8a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-13" />
      <circle cx="16.5" cy="13.5" r="1.1" />
    </>
  ),
  // A parcel with its tape seam.
  orders: (
    <>
      <path d="M20.5 8.2v7.6a1.6 1.6 0 0 1-.85 1.41l-6.9 3.6a1.6 1.6 0 0 1-1.5 0l-6.9-3.6a1.6 1.6 0 0 1-.85-1.41V8.2" />
      <path d="M3.9 7.6 11.25 3.8a1.6 1.6 0 0 1 1.5 0L20.1 7.6a.45.45 0 0 1 0 .8l-7.35 3.83a1.6 1.6 0 0 1-1.5 0L3.9 8.4a.45.45 0 0 1 0-.8Z" />
      <path d="M12 12.6v8.4" />
    </>
  ),
  // A lightning bolt: airtime, data, power.
  utilities: (
    <path d="M13.4 2.8 5.2 13.2a.5.5 0 0 0 .39.81h5.06l-.85 7.19 8.2-10.4a.5.5 0 0 0-.39-.81h-5.06Z" />
  ),
  // Fork and knife.
  food: (
    <>
      <path d="M7 3v7a2.2 2.2 0 0 0 2.2 2.2h.3V21" />
      <path d="M7 3v5.2" />
      <path d="M9.8 3v5.2" />
      <path d="M16.6 3c-1.4 1.1-2.1 2.8-2.1 5.1 0 1.7.7 2.9 2.1 3.4V21" />
    </>
  ),
  // A medical cross inside a rounded square.
  health: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.4v7.2" />
      <path d="M8.4 12h7.2" />
    </>
  ),
  // Three dots, for everything not yet built.
  more: (
    <>
      <circle cx="5.6" cy="12" r="1.35" />
      <circle cx="12" cy="12" r="1.35" />
      <circle cx="18.4" cy="12" r="1.35" />
    </>
  ),

  // A shopping trolley.
  supermarket: (
    <>
      <path d="M2.8 4h2.1a1 1 0 0 1 .97.76L6.3 7m0 0 1.85 7.4a1.6 1.6 0 0 0 1.55 1.2h7.2a1.6 1.6 0 0 0 1.55-1.2L20 8.6a1 1 0 0 0-.97-1.24H6.3Z" />
      <circle cx="10" cy="19.4" r="1.4" />
      <circle cx="17.2" cy="19.4" r="1.4" />
    </>
  ),
  // A cloche: a restaurant, not a takeaway.
  restaurant: (
    <>
      <path d="M3.2 17.4h17.6" />
      <path d="M4.6 14.6a7.4 7.4 0 0 1 14.8 0Z" />
      <path d="M12 7.2v-1.6" />
      <circle cx="12" cy="4.4" r="1.05" />
    </>
  ),
  // A capsule, split on the diagonal.
  pharmacy: (
    <>
      <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" />
      <path d="M9.2 9.2 14.8 14.8" />
    </>
  ),
  // A shirt with a collar.
  fashion: (
    <>
      <path d="M9 3.5 12 6l3-2.5 4.4 2.2a1 1 0 0 1 .52 1.14l-.86 3.3H17v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18.64V10.14H4.94l-.86-3.3A1 1 0 0 1 4.6 5.7Z" />
    </>
  ),
  // A phone handset, screen up.
  electronics: (
    <>
      <rect x="6.6" y="2.6" width="10.8" height="18.8" rx="2.6" />
      <path d="M10.4 5.4h3.2" />
      <path d="M12 18.2h.01" />
    </>
  ),
  // A lipstick bullet, angled.
  beauty: (
    <>
      <path d="M9.4 10.6V7.2l4.1-3.5a.9.9 0 0 1 1.5.69v6.21Z" />
      <rect x="9.4" y="10.6" width="5.6" height="4" rx="1" />
      <path d="M8.8 14.6h6.8v5a1.4 1.4 0 0 1-1.4 1.4h-4a1.4 1.4 0 0 1-1.4-1.4Z" />
    </>
  ),
  // A two-seat sofa.
  home: (
    <>
      <path d="M5.2 11.4V8.2a2.2 2.2 0 0 1 2.2-2.2h9.2a2.2 2.2 0 0 1 2.2 2.2v3.2" />
      <path d="M3.4 12.6a1.8 1.8 0 0 1 3.6 0v2h10v-2a1.8 1.8 0 0 1 3.6 0v4.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4Z" />
      <path d="M6 18.2V20" />
      <path d="M18 18.2V20" />
    </>
  ),
  // A spanner, angled as it would lie on a bench.
  hardware: (
    <path d="M15.1 3.4a5.3 5.3 0 0 0-4.35 8.35L3.9 18.6a1.6 1.6 0 0 0 2.26 2.26l6.85-6.85A5.3 5.3 0 0 0 20.3 8.6l-2.9 2.9-2.9-.6-.6-2.9 2.9-2.9a5.3 5.3 0 0 0-1.7-1.7Z" />
  ),
  // A bed with a headboard.
  hotel: (
    <>
      <path d="M3.4 19.6v-4.2a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v4.2" />
      <path d="M3.4 17h17.2" />
      <path d="M5.6 13.4V8.6a2 2 0 0 1 2-2h8.8a2 2 0 0 1 2 2v4.8" />
      <path d="M9.2 10.8h5.6" />
    </>
  ),
  // A handset with signal arcs: airtime, which is topping up a phone line —
  // not the handset alone, which is what `electronics` already means.
  airtime: (
    <>
      <rect x="4.6" y="2.6" width="9.8" height="18.8" rx="2.4" />
      <path d="M7.8 5.2h3.4" />
      <path d="M9.5 18.4h.01" />
      <path d="M17.2 8.4a5 5 0 0 1 0 7.2" />
      <path d="M19.8 5.8a8.6 8.6 0 0 1 0 12.4" />
    </>
  ),
  // A globe: a data bundle.
  data: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.6h17.6M3.2 14.4h17.6" />
      <path d="M12 3a15.4 15.4 0 0 1 0 18a15.4 15.4 0 0 1 0-18Z" />
    </>
  ),
  // A bulb: prepaid power.
  electricity: (
    <>
      <path d="M8.6 15.6a6 6 0 1 1 6.8 0v1.8H8.6Z" />
      <path d="M9.6 19.6h4.8" />
      <path d="M10.4 21.4h3.2" />
    </>
  ),
  // A television on a stand: a cable subscription.
  cableTv: (
    <>
      <rect x="2.8" y="7" width="18.4" height="12" rx="2.2" />
      <path d="M8.4 3.4 12 7l3.6-3.6" />
      <path d="M9 21.4h6" />
    </>
  ),
  // A cog: services, as opposed to goods. The outer ring is what stops it
  // reading as a sun — teeth alone around a dot is a brightness control.
  services: (
    <>
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M19 12h1.8M3.2 12H5M12 19v1.8M12 3.2V5M16.95 16.95l1.27 1.27M5.78 5.78 7.05 7.05M7.05 16.95l-1.27 1.27M18.22 5.78 16.95 7.05" />
    </>
  ),
  // A shopfront: the generic merchant. The awning overhangs the walls — that
  // overhang is the whole difference between reading as a shop and reading as
  // a house.
  store: (
    <>
      <path d="M2.4 9.2h19.2" />
      <path d="M4.6 4.4h14.8l2.2 4.8H2.4Z" />
      <path d="M4.9 9.2v9.8a1.6 1.6 0 0 0 1.6 1.6h11a1.6 1.6 0 0 0 1.6-1.6V9.2" />
      <path d="M8.4 20.6v-4.4a1.4 1.4 0 0 1 1.4-1.4h1.4a1.4 1.4 0 0 1 1.4 1.4v4.4" />
      <path d="M15.2 12.4h1.6" />
    </>
  ),
  // A scooter: the rider on the tracking map. Distinct from `ride`, which is
  // a car — a customer must be able to tell a delivery from a trip at a glance.
  scooter: (
    <>
      <circle cx="5.6" cy="17.2" r="2.9" />
      <circle cx="18.2" cy="17.2" r="2.9" />
      <path d="M8.5 17.2h6.8" />
      <path d="M18.2 17.2 16 8.2h-2.4" />
      <path d="M16 8.2h2.9" />
      <path d="M5.6 14.3V11a2 2 0 0 1 2-2h5.2" />
    </>
  ),
  // A house: the drop-off point.
  house: (
    <>
      <path d="M3.6 10.4 12 3.6l8.4 6.8" />
      <path d="M5.4 9v10a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4V9" />
      <path d="M9.6 20.4v-5.2h4.8v5.2" />
    </>
  ),
  // A four-point spark: "everything".
  all: (
    <path d="M12 3.2c.55 3.3 1.9 5.05 5.2 5.6-3.3.55-4.65 2.3-5.2 5.6-.55-3.3-1.9-5.05-5.2-5.6 3.3-.55 4.65-2.3 5.2-5.6Z" />
  ),
};

/**
 * A single icon.
 *
 * `size` is the rendered box in px; `color` defaults to `currentColor`, so a
 * tile that already sets a text colour needs to pass nothing. `title` makes it
 * announceable — omit it wherever an adjacent label already says the same
 * thing, which is the common case here, and the icon is hidden from screen
 * readers instead of read out twice.
 */
export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.8,
  title,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={style}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
