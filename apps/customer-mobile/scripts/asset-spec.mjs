// The one description of every native brand asset. Both the generator and the
// verifier read this, so "what we produce" and "what we check" cannot drift.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MASTER = resolve(ROOT, 'resources/dripplex-mark.svg');

/**
 * Brand faces, vendored so a render does not depend on what the machine has
 * installed. See resources/fonts/NOTICE.md for provenance and licence.
 */
export const FONT_DIR = resolve(ROOT, 'resources/fonts');

export const BLACK = '#000000';

/**
 * Where the painted artwork sits inside the master's canvas. Every cover
 * fraction below is derived from this, so it has to be the real ink box and
 * not a hardcoded guess.
 *
 * Two kinds of master are supported, because the brand file has been both:
 *
 *   • Vector — bounds come from the path data. The paths are absolute M/L/Z
 *     only, so every coordinate pair in them is a real point on the outline.
 *   • Bitmap wrapped in SVG — what the founder's exported logo is: a single
 *     <image> carrying a base64 PNG and no paths at all. There is nothing to
 *     parse, so the ink box is measured from the rendered alpha channel.
 *
 * Both return the same shape and the result is deterministic either way, which
 * is what the byte-for-byte CI check depends on.
 */
export function markGeometry() {
  const svg = readFileSync(MASTER, 'utf8');
  const viewBox = svg
    .match(/viewBox="([\d.\s-]+)"/)?.[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  if (!viewBox || viewBox.length !== 4) throw new Error('master SVG has no usable viewBox');
  const canvas = viewBox[2];

  const pts = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)]
    .flatMap(([, d]) => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)])
    .map(([, x, y]) => [Number(x), Number(y)]);

  if (pts.length > 0) {
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    return { svg, viewBox, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, canvas };
  }

  if (!/<image\b/.test(svg)) {
    throw new Error('master SVG has neither path coordinates nor an embedded image');
  }
  return { svg, viewBox, ...rasterInkBounds(canvas), canvas };
}

/**
 * Ink bounds of a bitmap master, from the alpha channel of a render at canvas
 * resolution.
 *
 * Run in a child process because sharp only exposes pixels asynchronously,
 * while APPROVED_COVER and ADAPTIVE_COVER below are evaluated at import time
 * and must be plain numbers. This is a build script, so paying for one process
 * is cheaper than making the whole spec async and rewriting both consumers.
 */
function rasterInkBounds(canvas) {
  const script = `
    const sharp = require(${JSON.stringify(createRequire(import.meta.url).resolve('sharp'))});
    sharp(${JSON.stringify(MASTER)}, { density: 300 })
      .resize(${canvas}, ${canvas}, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const { width: W, height: H, channels: C } = info;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            // 8 of 255 ignores the anti-aliased fringe, which would otherwise
            // report a box a pixel or two larger than the artwork.
            if (data[(y * W + x) * C + C - 1] > 8) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 < 0) throw new Error('master bitmap is fully transparent');
        process.stdout.write(JSON.stringify({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }));
      })
      .catch((e) => { console.error(e.message); process.exit(1); });
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
}

/**
 * The approved proportion: the mark spans 74.6% of the master canvas. Legacy
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
 * 0.6667 / sqrt(1 + (h/w)^2), not 0.6667. That works out at
 * ~0.519 for the DX mark's 0.806 aspect. Using the approved 0.746 here would
 * let every round launcher clip the bowl and the left-hand speed bars.
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

/**
 * Google Play feature graphic — 1024x500, no alpha, shown at the top of the
 * listing and in promotional placements.
 *
 * Composition is a left lockup, not a centred one, for two reasons Play
 * imposes: some placements overlay a play button over the middle, and some
 * crop the outer edges. Everything that carries meaning sits inside
 * FEATURE_SAFE_INSET of the frame.
 *
 * Copy is taken from docs/store/GOOGLE-PLAY.md verbatim — the title as Play
 * will show it and the approved tagline. Nothing here is invented ad copy.
 */
export const FEATURE_GRAPHIC = {
  file: 'resources/play-feature-graphic-1024x500.png',
  width: 1024,
  height: 500,
  alpha: false,
  /** Mark height as a fraction of the canvas height. */
  markCover: 0.46,
  /** Keep-clear border, as a fraction of the shorter edge. */
  safeInset: 0.11,
  title: 'DrippleX',
  tagline: 'life, Simplified.',
  note: 'Google Play 1024x500 feature graphic',
};

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
