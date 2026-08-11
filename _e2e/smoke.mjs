import { chromium } from 'playwright-core';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR =
  '/tmp/claude-0/-home-user-dripplex-platform/8df5c0c2-4a97-526f-ad37-fc1c59346aff/scratchpad/e2e-evidence';
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: `${DIR}/videos`, size: { width: 390, height: 844 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3006/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(1500);
const title = await page.title();
await page.screenshot({ path: `${DIR}/screenshots/smoke.png` });
await ctx.close();
await browser.close();
console.log('smoke OK — title:', JSON.stringify(title));
