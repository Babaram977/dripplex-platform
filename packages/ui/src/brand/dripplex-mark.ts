/**
 * Official DrippleX brand mark (SVG).
 *
 * Traced directly from the founder's approved brand-identity export
 * (`docs/reference/figma-super-app-source/dripplex-brand-identity.png`,
 * `DrippleX_Super_App_Design_Copy.zip`, 2026-08-03) using pixel-level
 * contour detection (OpenCV `findContours` on the green channel mask,
 * `approxPolyDP` simplified) — not hand-drawn or reconstructed from memory.
 * See `docs/FIGMA-SOURCE-INVENTORY-V2.md`.
 *
 * Gradient stops use the locked `BRAND_GREEN_LIGHT/MID/DARK` values from
 * `../tokens/colors.ts`. Direction (light top-left -> dark bottom-right)
 * matches the traced source image directly; note this is the reverse stop
 * order of that file's `GREEN_GRADIENT` CSS string, which is written for a
 * 135deg CSS angle — kept consistent with the actual visual reference here
 * rather than the CSS gradient's stop order.
 *
 * Natural aspect ratio preserved (134x112, not forced square) — the D mark
 * is not square in the source; the surrounding container should let it
 * center via default `preserveAspectRatio` rather than stretch it.
 */
export const dripplexMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 134 112" fill="none" role="img" aria-hidden="true" class="h-full w-full">
  <defs>
    <linearGradient id="dripplexMarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#47CF72"/>
      <stop offset="55%" stop-color="#2BAC52"/>
      <stop offset="100%" stop-color="#176B30"/>
    </linearGradient>
  </defs>
  <path fill="url(#dripplexMarkGradient)" d="M 32.2 1.0 L 28.0 11.5 L 33.2 18.8 L 80.5 18.8 L 100.5 25.8 L 113.0 43.2 L 114.0 61.5 L 108.0 76.5 L 95.5 88.0 L 59.2 92.0 L 75.8 57.5 L 72.5 53.0 L 3.2 54.0 L 0.0 62.5 L 5.2 67.8 L 51.0 68.2 L 31.0 110.5 L 85.5 111.8 L 113.5 99.8 L 128.8 80.5 L 133.8 64.5 L 131.8 37.2 L 120.8 18.2 L 91.5 1.0 Z"/>
  <path fill="url(#dripplexMarkGradient)" d="M 13.0 35.2 L 13.0 41.5 L 17.2 44.8 L 67.5 44.8 L 70.8 41.5 L 70.8 35.2 L 65.5 31.0 L 17.2 31.0 Z"/>
  <circle cx="26.0" cy="83.5" r="7.4" fill="url(#dripplexMarkGradient)"/>
</svg>`;
