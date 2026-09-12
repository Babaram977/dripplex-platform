#!/usr/bin/env node
/**
 * Capture the Google Play phone screenshots from the real super-app, signed in
 * as a real customer against a real backend. Nothing here mocks, seeds or
 * dresses up data — whatever the account actually has is what lands in the PNG.
 *
 *   DPX_BASE=https://app.dripplex.com \
 *   DPX_CUSTOMER_EMAIL=... DPX_CUSTOMER_PASSWORD=... \
 *   node scripts/capture-screenshots.mjs
 *
 * Output: resources/play-screenshots/*.png, 1080x1920 each.
 *
 * For the App Store, set DPX_DEVICE — the sizes Apple requires are different
 * from Play's and it rejects anything that is not exact:
 *
 *   DPX_DEVICE=ios-6.7 ... -> resources/ios-screenshots/6.7/*.png, 1290x2796
 *   DPX_DEVICE=ios-6.5 ... -> resources/ios-screenshots/6.5/*.png, 1284x2778
 *
 * WHY 360x640 AT deviceScaleFactor 3
 * 1080x1920 is Play's phone minimum and 9:16 is inside its aspect limits, and
 * 360 CSS px puts the app below the 480px breakpoint in App.tsx's GLOBAL_STYLES
 * — so it renders full bleed as a handset does, not inside the desktop
 * phone-frame mockup with its bezel, notch and fake 9:41 clock.
 *
 * PROXYING
 * Set DPX_PROXY_UPSTREAM=1 when the browser cannot reach the public internet
 * but Node can (the CI sandbox is like this). Requests to the R2 media bucket
 * and Google Fonts are then fetched in Node and fulfilled into the page. Both
 * still return the genuine production asset; without it every product card
 * renders blank and Poppins/Inter silently fall back to a system face.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * DEVICE PROFILES
 *
 * `play` is the original behaviour and the default, so nothing about the Play
 * capture changes. The two iOS profiles exist because App Store Connect will
 * not accept a submission without 6.7" and 6.5" phone screenshots, and it
 * rejects anything that is not exactly the pixel size it asks for.
 *
 * The CSS widths matter as much as the output size: 430 and 428 are both under
 * the 480px breakpoint in App.tsx's GLOBAL_STYLES, so the app renders full
 * bleed as a handset does rather than inside the desktop phone-frame mockup
 * with its bezel and fake 9:41 clock. A 6.7" shot taken at 1290 CSS px would be
 * a picture of the desktop site.
 */
const DEVICES = {
  play: { width: 360, height: 640, scale: 3, out: 'resources/play-screenshots' },
  // iPhone 15 Pro Max / 14 Pro Max — 1290x2796
  'ios-6.7': { width: 430, height: 932, scale: 3, out: 'resources/ios-screenshots/6.7' },
  // iPhone 14 Plus / 13 Pro Max — 1284x2778
  'ios-6.5': { width: 428, height: 926, scale: 3, out: 'resources/ios-screenshots/6.5' },
};

const DEVICE_KEY = process.env['DPX_DEVICE'] ?? 'play';
const DEVICE = DEVICES[DEVICE_KEY];
if (!DEVICE) {
  console.error(`unknown DPX_DEVICE "${DEVICE_KEY}" — one of: ${Object.keys(DEVICES).join(', ')}`);
  process.exit(1);
}
console.log(
  `device ${DEVICE_KEY}: ${DEVICE.width}x${DEVICE.height} @${DEVICE.scale}x ` +
    `-> ${DEVICE.width * DEVICE.scale}x${DEVICE.height * DEVICE.scale}`,
);
const OUT = resolve(ROOT, DEVICE.out);
const BASE = process.env['DPX_BASE'] ?? 'http://127.0.0.1:4180';
const EMAIL = process.env['DPX_CUSTOMER_EMAIL'];
const PASSWORD = process.env['DPX_CUSTOMER_PASSWORD'];
if (!EMAIL || !PASSWORD) {
  console.error('set DPX_CUSTOMER_EMAIL and DPX_CUSTOMER_PASSWORD');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

/**
 * Kano — PLATFORM_BASE_CENTRE from packages/types/src/platform/service-area.ts.
 * This is only the browser's location permission, i.e. what a handset sitting
 * in Kano reports; every address it turns into comes from the live geocoder.
 */
const KANO = { latitude: 12.0022, longitude: 8.592 };

const browser = await chromium.launch({
  executablePath: process.env['CHROMIUM_PATH'] || undefined,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: DEVICE.width, height: DEVICE.height },
  deviceScaleFactor: DEVICE.scale,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
  locale: 'en-NG',
  timezoneId: 'Africa/Lagos',
  geolocation: KANO,
  permissions: ['geolocation'],
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
});

let proxied = 0;
let proxyFailed = 0;
if (process.env['DPX_PROXY_UPSTREAM'] === '1') {
  await ctx.route(
    /https:\/\/(pub-[a-z0-9]+\.r2\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
    async (route) => {
      try {
        const up = await fetch(route.request().url(), { headers: { 'user-agent': 'Mozilla/5.0' } });
        proxied += 1;
        await route.fulfill({
          status: up.status,
          contentType: up.headers.get('content-type') ?? 'application/octet-stream',
          body: Buffer.from(await up.arrayBuffer()),
        });
      } catch {
        proxyFailed += 1;
        await route.abort();
      }
    },
  );
}

const page = await ctx.newPage();
const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log('  ✓', n);
};
const home = async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
};

/** Scroll the app's own scroller — the page itself never scrolls. */
const scrollTo = async (top) => {
  await page.evaluate((t) => {
    const s = [...document.querySelectorAll('*')].find(
      (n) => n.scrollHeight > n.clientHeight + 40 && getComputedStyle(n).overflowY !== 'visible',
    );
    if (s) s.scrollTop = t;
  }, top);
  await page.waitForTimeout(1500);
};

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page
  .getByText('I already have an account')
  .click()
  .catch(() => {});
await page.waitForTimeout(2000);
await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page
  .getByRole('button', { name: /sign in/i })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(7000);
await shot('01-home');

// Marketplace is scrolled past the "Ask Drip — Coming soon" card to Trending
// Products, which is the section with real merchandise in it.
for (const [label, file, scroll, settle] of [
  ['Marketplace', '02-marketplace', 780, 9000],
  ['Ride', '03-ride', 0, 12000],
  ['Wallet', '04-wallet', 0, 7000],
  ['Orders', '05-orders', 0, 7000],
]) {
  await home();
  const t = page.getByText(label, { exact: true }).first();
  if (!(await t.count())) {
    console.log('  – no entry point for', label);
    continue;
  }
  await t.click().catch(() => {});
  await page.waitForTimeout(settle);
  if (scroll) await scrollTo(scroll);
  await shot(file);
}
if (process.env['DPX_PROXY_UPSTREAM'] === '1') {
  console.log(`proxied ${proxied} upstream assets, ${proxyFailed} failed`);
}
await browser.close();
