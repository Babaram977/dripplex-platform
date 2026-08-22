#!/usr/bin/env node
/**
 * Regenerate every native launcher icon, store icon and splash image from
 * resources/dripplex-mark.svg.
 *
 * Run after any change to the master. Output is deterministic: the same master
 * always produces the same bytes, so a dirty git tree after running this means
 * someone hand-edited a PNG.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

import {
  ROOT,
  BLACK,
  FONT_DIR,
  markGeometry,
  ADAPTIVE_COVER,
  ROUND_COVER,
  SPLASH_COVER,
  ICONS,
  ROUND_ICONS,
  ADAPTIVE_FOREGROUNDS,
  STORE_ICONS,
  SPLASHES,
  FEATURE_GRAPHIC,
} from './asset-spec.mjs';

/**
 * Render the feature graphic's text from the fonts in this repo, not from
 * whatever the machine happens to have installed.
 *
 * CI regenerates every asset and fails if a single byte differs from what is
 * committed. Left to system fontconfig that check fails on any runner without
 * Poppins — and worse, it can PASS the "did the text draw" verification while
 * silently substituting a fallback face, because a fallback still paints
 * pixels. Pinning the font files makes the output identical everywhere.
 *
 * Set before sharp is required: librsvg reads fontconfig when it initialises.
 */
const FONTCONF = join(mkdtempSync(join(tmpdir(), 'dpx-fonts-')), 'fonts.conf');
writeFileSync(
  FONTCONF,
  `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${dirname(FONTCONF)}/cache</cachedir>
</fontconfig>
`,
);
process.env['FONTCONFIG_FILE'] = FONTCONF;

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const g = markGeometry();

/** The master's <defs> and drawing group, without its own black backdrop. */
const ART = (() => {
  const defs = g.svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const body = g.svg.match(/<g\b[\s\S]*<\/g>/)?.[0];
  if (!body) throw new Error('master SVG has no drawing group');
  return { defs, body };
})();

/**
 * Compose the mark onto a canvas.
 *
 * `cover` is the mark's width as a fraction of `fit` (the shorter edge for
 * non-square canvases). The gradient is left exactly as authored — it uses
 * default objectBoundingBox units so it resolves per path, which survives any
 * transform unchanged. That per-path look is the approved artwork.
 */
function compose({ width, height, cover, background, circle = false }) {
  const fit = Math.min(width, height);
  const w = fit * cover,
    s = w / g.w;
  const tx = (width - w) / 2 - g.x * s;
  const ty = (height - g.h * s) / 2 - g.y * s;
  const bg = !background
    ? ''
    : circle
      ? `<circle cx="${width / 2}" cy="${height / 2}" r="${fit / 2}" fill="${background}"/>`
      : `<rect width="${width}" height="${height}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${bg}${ART.defs}
<g transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${s.toFixed(6)})">${ART.body}</g>
</svg>`;
}

/**
 * The Play feature graphic: mark, title and tagline as one left-aligned
 * lockup on black.
 *
 * Left rather than centred because Play overlays a play button across the
 * middle of this image in placements that have a promo video, and crops the
 * outer edges in others. Everything meaningful stays inside the safe inset.
 *
 * Type is the locked Figma system — Poppins for the title, Inter for the
 * tagline (see apps/customer-web/src/app/layout.tsx). Both must be installed
 * for the render; the verifier fails loudly if the text did not draw.
 */
function composeFeature({ width, height, markCover, safeInset, title, tagline }, dx = 0) {
  const inset = Math.min(width, height) * safeInset;
  const markH = height * markCover;
  const s = markH / g.h;
  const markW = g.w * s;
  const tx = inset - g.x * s;
  const ty = (height - markH) / 2 - g.y * s;

  const textX = inset + markW + inset * 0.86;
  const titleSize = height * 0.184;
  const taglineSize = height * 0.068;
  // The lockup is optically centred on the mark, not mathematically stacked:
  // the title sits above the midline and the tagline below it.
  const titleY = height / 2 - height * 0.012;
  const taglineY = titleY + taglineSize * 1.62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${BLACK}"/>${ART.defs}
<g transform="translate(${dx.toFixed(4)} 0)">
<g transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${s.toFixed(6)})">${ART.body}</g>
<text x="${textX.toFixed(2)}" y="${titleY.toFixed(2)}" fill="#FFFFFF" font-family="Poppins SemiBold, Poppins, sans-serif" font-weight="600" font-size="${titleSize.toFixed(2)}" letter-spacing="${(-titleSize * 0.018).toFixed(3)}">${title}</text>
<text x="${textX.toFixed(2)}" y="${taglineY.toFixed(2)}" fill="#62FF00" font-family="Inter, sans-serif" font-weight="400" font-size="${taglineSize.toFixed(2)}" letter-spacing="${(taglineSize * 0.01).toFixed(3)}">${tagline}</text>
</g>
</svg>`;
}

/**
 * Centre the lockup by measuring where the ink actually lands, not by adding
 * up font metrics. Text width depends on the installed face and its kerning,
 * so a computed guess drifts the moment either changes; trimming the rendered
 * pixels cannot.
 */
async function centredFeature(spec) {
  const density = 144;
  const scale = 72 / density;
  const flat = await sharp(Buffer.from(composeFeature(spec, 0)), { density })
    .flatten({ background: BLACK })
    .png()
    .toBuffer();
  const { info } = await sharp(flat).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const inkLeft = -(info.trimOffsetLeft ?? 0) * scale;
  const inkWidth = info.width * scale;
  const dx = (spec.width - inkWidth) / 2 - inkLeft;
  return composeFeature(spec, dx);
}

/**
 * Supersample factor. Rasterising a 48px icon at 48px leaves visibly ragged
 * diagonals, so small targets are rendered large and scaled down with a proper
 * filter. Capped so the biggest canvas (2732px splash) stays inside sharp's
 * pixel limit rather than blowing up mid-run.
 */
function supersample(width, height) {
  return Math.max(1, Math.min(4, Math.floor(4096 / Math.max(width, height))));
}

async function emit(file, svg, { width, height, alpha = true } = {}) {
  const out = resolve(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  const ss = supersample(width, height);
  let img = sharp(Buffer.from(svg), { density: 72 * ss });
  if (ss > 1) img = img.resize(width, height, { kernel: 'lanczos3' });
  if (!alpha) img = img.flatten({ background: BLACK });
  writeFileSync(out, await img.png({ compressionLevel: 9 }).toBuffer());
  return file;
}

const jobs = [];

for (const { file, size, cover, alpha } of [...ICONS, ...STORE_ICONS]) {
  jobs.push(
    emit(file, compose({ width: size, height: size, cover, background: BLACK }), {
      width: size,
      height: size,
      alpha,
    }),
  );
}

for (const { file, size } of ROUND_ICONS) {
  // Transparent outside the circle so launchers that expect a round icon get one.
  jobs.push(
    emit(
      file,
      compose({ width: size, height: size, cover: ROUND_COVER, background: BLACK, circle: true }),
      { width: size, height: size },
    ),
  );
}

for (const { file, size } of ADAPTIVE_FOREGROUNDS) {
  // No background: the adaptive <background> layer supplies it (@color/ic_launcher_background).
  jobs.push(
    emit(file, compose({ width: size, height: size, cover: ADAPTIVE_COVER }), {
      width: size,
      height: size,
    }),
  );
}

for (const { file, width, height } of SPLASHES) {
  jobs.push(
    emit(file, compose({ width, height, cover: SPLASH_COVER, background: BLACK }), {
      width,
      height,
      alpha: false,
    }),
  );
}

jobs.push(
  emit(FEATURE_GRAPHIC.file, await centredFeature(FEATURE_GRAPHIC), {
    width: FEATURE_GRAPHIC.width,
    height: FEATURE_GRAPHIC.height,
    alpha: FEATURE_GRAPHIC.alpha,
  }),
);

const written = await Promise.all(jobs);
console.log(`generated ${written.length} assets from resources/dripplex-mark.svg`);
