import { chromium } from 'playwright-core';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3006/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
// dump top-level structure: count buttons/links, and sidebar text
const info = await page.evaluate(() => {
  const clickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  const texts = clickables
    .slice(0, 60)
    .map((e) => (e.textContent || '').trim().slice(0, 40))
    .filter(Boolean);
  // find likely sidebar: an element with many nav items
  const asideCandidates = Array.from(
    document.querySelectorAll('aside, nav, [class*="sidebar"], [class*="catalog"]'),
  ).map((a) => ({
    tag: a.tagName,
    cls: (a.className || '').toString().slice(0, 60),
    items: a.querySelectorAll('button,a').length,
  }));
  return { totalClickables: clickables.length, sampleTexts: texts, asideCandidates };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await b.close();
