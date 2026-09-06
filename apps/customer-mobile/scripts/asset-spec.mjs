// The one description of every native brand asset. Both the generator and the
// verifier read this, so "what we produce" and "what we check" cannot drift.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The approved dX mark (founder-supplied 2026-09-06), replacing the earlier
 * `dripplex-mark.svg` — a D with speed lines and no X.
 *
 * It is a raster, not a vector, because that is the form the artwork was
 * approved in. Nothing here traces or redraws it: the committed PNG is the
 * founder's file byte for byte, and every generated asset is a resampling of
 * it. Re-deriving a vector would be inventing artwork nobody signed off.
 *
 * The practical cost is a ceiling on upscaling. The painted mark is 939px
 * wide; the largest place it lands is the 2732px splash at SPLASH_COVER,
 * which asks for ~1147px — a 1.22x enlargement, soft enough to be invisible
 * behind a splash but real. Everything else downsamples. If a vector ever
 * arrives, only `loadMaster()` needs to change.
 */
export const MASTER = resolve(ROOT, 'resources/dripplex-dx-mark.png');

/**
 * Brand faces, vendored so a render does not depend on what the machine has
 * installed. See resources/fonts/NOTICE.md for provenance and licence.
 */
export const FONT_DIR = resolve(ROOT, 'resources/fonts');

export const BLACK = '#000000';

/**
 * The proportion the mark spans of its own canvas, as approved. The verifier
 * compares the master against this and fails if it drifts, so swapping in new
 * artwork is a deliberate act with a human in the loop rather than something
 * that silently reflows every icon on the platform.
 */
export const APPROVED_PROPORTION = 0.7488;

/**
 * Anything darker than this on all three channels is the master's black
 * ground rather than painted artwork. Measured, not guessed: 60.1% of the
 * master is exactly #000000 and 78.6% is within this threshold, and the gap
 * between the two is the mark's own glow.
 */
const INK_THRESHOLD = 6;

/**
 * Decode the master once: where the artwork sits inside its canvas, and the
 * artwork itself on a transparent ground.
 *
 * The supplied PNG has black baked in. Every canvas the mark lands on is also
 * black, so compositing it directly would be pixel-faithful there — but
 * adaptive-icon foregrounds must be transparent, and a baked black square
 * would defeat the launcher's own background layer. So the ground is undone
 * here instead: for artwork composited over black, `alpha = max(r,g,b)` with
 * the colour unmultiplied by it reproduces the original exactly when it is
 * composited back over black, and degrades gracefully anywhere else.
 */
export async function loadMaster() {
  const { data, info } = await sharp(MASTER)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width !== height) throw new Error(`master must be square, found ${width}x${height}`);

  const out = Buffer.alloc(width * height * 4);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const a = Math.max(r, g, b);
      const o = (y * width + x) * 4;
      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        out[o] = Math.min(255, Math.round((r * 255) / a));
        out[o + 1] = Math.min(255, Math.round((g * 255) / a));
        out[o + 2] = Math.min(255, Math.round((b * 255) / a));
        out[o + 3] = a;
      }
      if (a > INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('master has no painted pixels');

  const artwork = await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    canvas: width,
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    artwork,
  };
}

/**
 * The approved proportion, read off the master rather than hardcoded — the
 * legacy launcher icons, the App Store icon and the Play listing icon all
 * reproduce it exactly. Adaptive icons cannot; see adaptiveCover.
 */
export const approvedCover = (g) => g.w / g.canvas;

/**
 * Android adaptive icons are 108dp with only the central 72dp guaranteed to
 * survive the launcher mask, and a circular mask keeps only the inscribed
 * circle — 66.67% of the canvas across. A bounding box fits inside that circle
 * when its DIAGONAL is within it, so the width available is
 * 0.6667 / sqrt(1 + (h/w)^2), not 0.6667. For this mark's 0.812 aspect that is
 * ~0.518. Using the approved 0.749 here would let every round launcher clip
 * the X and the left-hand speed bars.
 */
export const adaptiveCover = (g) => 0.6667 / Math.hypot(1, g.h / g.w);

/** Mark size on splash screens, as a fraction of the SHORTER canvas edge. */
export const SPLASH_COVER = 0.42;

const ANDROID = 'android/app/src/main/res';

/** Square icons: black ground, mark centred, `cover` of the canvas wide. */
export const icons = (cover) => [
  {
    file: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    size: 1024,
    cover,
    alpha: false,
    note: 'App Store / iOS app icon',
  },
  { file: `${ANDROID}/mipmap-mdpi/ic_launcher.png`, size: 48, cover, alpha: false },
  { file: `${ANDROID}/mipmap-hdpi/ic_launcher.png`, size: 72, cover, alpha: false },
  { file: `${ANDROID}/mipmap-xhdpi/ic_launcher.png`, size: 96, cover, alpha: false },
  { file: `${ANDROID}/mipmap-xxhdpi/ic_launcher.png`, size: 144, cover, alpha: false },
  { file: `${ANDROID}/mipmap-xxxhdpi/ic_launcher.png`, size: 192, cover, alpha: false },
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
export const storeIcons = (cover) => [
  {
    file: 'resources/play-store-icon-512.png',
    size: 512,
    cover,
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
