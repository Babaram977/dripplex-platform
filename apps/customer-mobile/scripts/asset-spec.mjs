// The one description of every native brand asset. Both the generator and the
// verifier read this, so "what we produce" and "what we check" cannot drift.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MASTER = resolve(ROOT, 'resources/dripplex-mark.svg');

export const BLACK = '#000000';

/**
 * Bounds of the painted artwork inside the master's 1254 canvas, read from the
 * path data itself rather than hardcoded — the paths are absolute M/L/Z only,
 * so every coordinate pair in them is a real point on the outline.
 */
export function markGeometry() {
  const svg = readFileSync(MASTER, 'utf8');
  const viewBox = svg
    .match(/viewBox="([\d.\s-]+)"/)?.[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  if (!viewBox || viewBox.length !== 4) throw new Error('master SVG has no usable viewBox');

  const pts = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)]
    .flatMap(([, d]) => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)])
    .map(([, x, y]) => [Number(x), Number(y)]);
  if (pts.length === 0) throw new Error('master SVG has no path coordinates');

  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  const w = Math.max(...xs) - x,
    h = Math.max(...ys) - y;
  return { svg, viewBox, x, y, w, h, canvas: viewBox[2] };
}

/**
 * The approved proportion: the mark spans 75.4% of the master canvas. Legacy
 * launcher icons, the App Store icon and the Play listing icon all reproduce it
 * exactly. Adaptive icons cannot — see ADAPTIVE_COVER.
 */
export const APPROVED_COVER = (() => {
  const g = markGeometry();
  return g.w / g.canvas;
})();

/**
 * Android adaptive icons are 108dp with only the central 72dp guaranteed to
 * survive the launcher mask, and a circular mask keeps only the inscribed
 * circle — 66.67% of the canvas across. A bounding box fits inside that circle
 * when its DIAGONAL is within it, so the width available is
 * 0.6667 / sqrt(1 + (h/w)^2), not 0.6667. For this mark's 1.168 aspect that is
 * ~0.507. Using the approved 0.754 here would let every round launcher clip the
 * bowl and the left-hand speed bars.
 */
export const ADAPTIVE_COVER = (() => {
  const g = markGeometry();
  return 0.6667 / Math.hypot(1, g.h / g.w);
})();

/** Mark size on splash screens, as a fraction of the SHORTER canvas edge. */
export const SPLASH_COVER = 0.42;

const ANDROID = 'android/app/src/main/res';

/** Square icons: black ground, mark centred, `cover` of the canvas wide. */
export const ICONS = [
  {
    file: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    size: 1024,
    cover: APPROVED_COVER,
    alpha: false,
    note: 'App Store / iOS app icon',
  },
  { file: `${ANDROID}/mipmap-mdpi/ic_launcher.png`, size: 48, cover: APPROVED_COVER, alpha: false },
  { file: `${ANDROID}/mipmap-hdpi/ic_launcher.png`, size: 72, cover: APPROVED_COVER, alpha: false },
  {
    file: `${ANDROID}/mipmap-xhdpi/ic_launcher.png`,
    size: 96,
    cover: APPROVED_COVER,
    alpha: false,
  },
  {
    file: `${ANDROID}/mipmap-xxhdpi/ic_launcher.png`,
    size: 144,
    cover: APPROVED_COVER,
    alpha: false,
  },
  {
    file: `${ANDROID}/mipmap-xxxhdpi/ic_launcher.png`,
    size: 192,
    cover: APPROVED_COVER,
    alpha: false,
  },
];

/** Legacy round icons: the black ground is a circle, so the mark keeps room. */
export const ROUND_ICONS = [
  { file: `${ANDROID}/mipmap-mdpi/ic_launcher_round.png`, size: 48 },
  { file: `${ANDROID}/mipmap-hdpi/ic_launcher_round.png`, size: 72 },
  { file: `${ANDROID}/mipmap-xhdpi/ic_launcher_round.png`, size: 96 },
  { file: `${ANDROID}/mipmap-xxhdpi/ic_launcher_round.png`, size: 144 },
  { file: `${ANDROID}/mipmap-xxxhdpi/ic_launcher_round.png`, size: 192 },
];
export const ROUND_COVER = 0.7;

/** Adaptive foregrounds: transparent, mark inside the mask-safe circle. */
export const ADAPTIVE_FOREGROUNDS = [
  { file: `${ANDROID}/mipmap-mdpi/ic_launcher_foreground.png`, size: 108 },
  { file: `${ANDROID}/mipmap-hdpi/ic_launcher_foreground.png`, size: 162 },
  { file: `${ANDROID}/mipmap-xhdpi/ic_launcher_foreground.png`, size: 216 },
  { file: `${ANDROID}/mipmap-xxhdpi/ic_launcher_foreground.png`, size: 324 },
  { file: `${ANDROID}/mipmap-xxxhdpi/ic_launcher_foreground.png`, size: 432 },
];

/** Play Console listing icon. Not consumed by the build; produced for upload. */
export const STORE_ICONS = [
  {
    file: 'resources/play-store-icon-512.png',
    size: 512,
    cover: APPROVED_COVER,
    alpha: false,
    note: 'Google Play 512x512 listing icon',
  },
];

/** Splash screens. Sizes match what the native projects already reference. */
export const SPLASHES = [
  { file: `${ANDROID}/drawable/splash.png`, width: 480, height: 320 },
  { file: `${ANDROID}/drawable-port-mdpi/splash.png`, width: 320, height: 480 },
  { file: `${ANDROID}/drawable-port-hdpi/splash.png`, width: 480, height: 800 },
  { file: `${ANDROID}/drawable-port-xhdpi/splash.png`, width: 720, height: 1280 },
  { file: `${ANDROID}/drawable-port-xxhdpi/splash.png`, width: 960, height: 1600 },
  { file: `${ANDROID}/drawable-port-xxxhdpi/splash.png`, width: 1280, height: 1920 },
  { file: `${ANDROID}/drawable-land-mdpi/splash.png`, width: 480, height: 320 },
  { file: `${ANDROID}/drawable-land-hdpi/splash.png`, width: 800, height: 480 },
  { file: `${ANDROID}/drawable-land-xhdpi/splash.png`, width: 1280, height: 720 },
  { file: `${ANDROID}/drawable-land-xxhdpi/splash.png`, width: 1600, height: 960 },
  { file: `${ANDROID}/drawable-land-xxxhdpi/splash.png`, width: 1920, height: 1280 },
  {
    file: 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
    width: 2732,
    height: 2732,
  },
  {
    file: 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
    width: 2732,
    height: 2732,
  },
  {
    file: 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png',
    width: 2732,
    height: 2732,
  },
];
