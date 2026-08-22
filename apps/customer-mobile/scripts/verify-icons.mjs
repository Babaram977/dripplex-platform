#!/usr/bin/env node
/**
 * Assert every generated native asset is what it should be.
 *
 * This exists because the failure that motivated it was silent: an icon can
 * render, look plausible in a thumbnail, and still be missing a whole element
 * of the mark. Checking "the file exists" would not have caught it.
 *
 *   node scripts/verify-icons.mjs
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

import {
  ROOT,
  markGeometry,
  ADAPTIVE_COVER,
  ICONS,
  ROUND_ICONS,
  ADAPTIVE_FOREGROUNDS,
  STORE_ICONS,
  SPLASHES,
  FEATURE_GRAPHIC,
} from './asset-spec.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const failures = [];
const fail = (file, why) => failures.push(`${file}\n      ${why}`);

async function raw(file) {
  const { data, info } = await sharp(resolve(ROOT, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  };
  const painted = (x, y) => {
    const p = at(x, y);
    return p.a > 128 && p.g > 60 && p.g > p.r + 20;
  };
  return { info, at, painted };
}

/** Distinct vertical bands of mark pixels down a column. */
function bands(painted, x, height) {
  let n = 0,
    run = false;
  for (let y = 0; y < height; y++) {
    const on = painted(x, y);
    if (on && !run) n++;
    run = on;
  }
  return n;
}

async function checkSize(file, width, height) {
  if (!existsSync(resolve(ROOT, file))) {
    fail(file, 'missing');
    return false;
  }
  const m = await sharp(resolve(ROOT, file)).metadata();
  if (m.width !== width || m.height !== height) {
    fail(file, `expected ${width}x${height}, found ${m.width}x${m.height}`);
    return false;
  }
  return true;
}

/**
 * The mark has four elements stacked vertically — top bar, middle bar, long
 * bar, and the diagonal/bowl. A column through all four must cross exactly
 * four painted bands. Three means one was dropped, which is precisely what a
 * degenerate gradient does to a zero-height shape: it renders nothing at all,
 * with no error anywhere.
 */
async function checkMarkIntact(file, size) {
  if (size < 96) return; // below this the bands merge; covered at larger sizes
  const { info, painted } = await raw(file);
  const x = Math.round(info.width * 0.34);
  const n = bands(painted, x, info.height);
  if (n !== 4)
    fail(
      file,
      `column x=${x} crosses ${n} painted bands, expected 4 — an element of the mark is missing or merged`,
    );
}

async function checkOpaque(file) {
  const m = await sharp(resolve(ROOT, file)).metadata();
  if (m.hasAlpha)
    fail(
      file,
      'has an alpha channel — the App Store and Play both reject transparency in app icons',
    );
}

async function checkBlackGround(file) {
  const { at } = await raw(file);
  const c = at(2, 2);
  if (c.r > 12 || c.g > 12 || c.b > 12)
    fail(file, `corner pixel is rgb(${c.r},${c.g},${c.b}), expected black`);
}

/**
 * Adaptive foregrounds are masked by the launcher; a circular mask keeps only
 * the inscribed circle of the 108dp canvas. Anything painted outside it is
 * clipped on real devices, so nothing may be painted there.
 */
async function checkAdaptiveSafeZone(file) {
  const { info, at } = await raw(file);
  const cx = info.width / 2,
    cy = info.height / 2,
    r = (info.width * 0.6667) / 2;
  let outside = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (at(x, y).a > 128 && Math.hypot(x - cx, y - cy) > r) outside++;
    }
  }
  if (outside > 0)
    fail(
      file,
      `${outside} opaque pixels fall outside the mask-safe circle and would be clipped by round launchers`,
    );
}

/** The stock Capacitor logo is blue. Any blue-dominant icon is a regression. */
async function checkNotCapacitor(file) {
  const { data, info } = await sharp(resolve(ROOT, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let blue = 0,
    green = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) continue;
    if (data[i + 2] > data[i + 1] + 20) blue++;
    if (data[i + 1] > data[i + 2] + 20) green++;
  }
  if (blue > green)
    fail(file, 'blue-dominant — this looks like the stock Capacitor logo, not the DrippleX mark');
}

// ── run ──────────────────────────────────────────────────────────────────────
/**
 * The feature graphic must actually contain its text.
 *
 * If Poppins or Inter are not installed on the machine that ran the generator,
 * librsvg silently draws nothing (or a fallback face) and the PNG still looks
 * plausible at a glance — black, mark on the left, empty on the right. This is
 * the check that catches a missing font, so it looks for white pixels to the
 * RIGHT of the mark, where only the title can be.
 */
async function checkFeatureGraphic(spec) {
  const { file, width, height } = spec;
  if (!(await checkSize(file, width, height))) return;
  await checkOpaque(file);
  await checkBlackGround(file);
  await checkNotCapacitor(file);

  const { info, at } = await raw(file);
  const isWhite = (p) => p.r > 200 && p.g > 200 && p.b > 200;
  const isGreen = (p) => p.g > 90 && p.g > p.r + 30 && p.g > p.b + 30;

  let white = 0;
  let greenRight = 0;
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = at(x, y);
      const lit = isWhite(p) || isGreen(p);
      if (!lit) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (isWhite(p)) white++;
      if (isGreen(p) && x > info.width * 0.45) greenRight++;
    }
  }

  // The title is the only white in the composition — the mark is all green.
  if (white < 2000) {
    fail(
      file,
      `only ${white} white pixels — the title did not render. Poppins is probably not installed; run: fc-list | grep -i poppins`,
    );
  }
  // The tagline is green and sits right of the mark.
  if (greenRight < 500) {
    fail(
      file,
      `only ${greenRight} green pixels right of centre — the tagline did not render (Inter missing?)`,
    );
  }

  const inset = Math.min(width, height) * spec.safeInset;
  if (
    minX < inset * 0.6 ||
    maxX > width - inset * 0.6 ||
    minY < inset * 0.6 ||
    maxY > height - inset * 0.6
  ) {
    fail(
      file,
      `artwork reaches (${minX},${minY})-(${maxX},${maxY}), inside the ${Math.round(inset)}px keep-clear border Play may crop`,
    );
  }

  // Centred within 2% of the canvas — the ink-measured centring must hold.
  const drift = Math.abs((minX + maxX) / 2 - width / 2);
  if (drift > width * 0.02) {
    fail(file, `lockup is ${Math.round(drift)}px off centre, beyond the 2% tolerance`);
  }
}

const g = markGeometry();
if (Math.abs(g.w / g.canvas - 0.7536) > 0.001) {
  fail(
    'resources/dripplex-mark.svg',
    `mark now covers ${(g.w / g.canvas).toFixed(4)} of its canvas; the approved proportion is 0.7536`,
  );
}
if (ADAPTIVE_COVER * Math.hypot(1, g.h / g.w) > 0.6667 + 1e-9) {
  fail('asset-spec.mjs', 'ADAPTIVE_COVER would put the mark outside the adaptive-icon safe circle');
}

for (const { file, size, alpha } of [...ICONS, ...STORE_ICONS]) {
  if (!(await checkSize(file, size, size))) continue;
  if (alpha === false) await checkOpaque(file);
  await checkBlackGround(file);
  await checkMarkIntact(file, size);
  await checkNotCapacitor(file);
}
for (const { file, size } of ROUND_ICONS) {
  if (!(await checkSize(file, size, size))) continue;
  await checkMarkIntact(file, size);
  await checkNotCapacitor(file);
}
for (const { file, size } of ADAPTIVE_FOREGROUNDS) {
  if (!(await checkSize(file, size, size))) continue;
  await checkAdaptiveSafeZone(file);
  await checkNotCapacitor(file);
}
for (const { file, width, height } of SPLASHES) {
  if (!(await checkSize(file, width, height))) continue;
  await checkOpaque(file);
  await checkBlackGround(file);
  await checkNotCapacitor(file);
}

await checkFeatureGraphic(FEATURE_GRAPHIC);

const total =
  1 +
  ICONS.length +
  STORE_ICONS.length +
  ROUND_ICONS.length +
  ADAPTIVE_FOREGROUNDS.length +
  SPLASHES.length;
if (failures.length) {
  console.error(`\n  ${failures.length} problem(s) across ${total} assets:\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`all ${total} native brand assets verified`);
