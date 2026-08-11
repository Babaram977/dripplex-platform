import { chromium } from 'playwright-core';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3006/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);
const info = await page.evaluate(() => {
  // The sidebar group headers contain emojis like 🔐; find their common ancestor
  const groupHeader = Array.from(document.querySelectorAll('button,a')).find(
    (e) => /Auth/.test(e.textContent || '') && /🔐/.test(e.textContent || ''),
  );
  function pathOf(el) {
    if (!el) return null;
    let p = [];
    let n = el;
    for (let i = 0; i < 4 && n; i++) {
      p.unshift(
        n.tagName +
          (n.className ? '.' + String(n.className).trim().split(/\s+/).slice(0, 2).join('.') : ''),
      );
      n = n.parentElement;
    }
    return p.join(' > ');
  }
  const sidebar = groupHeader
    ? groupHeader.closest('div[class*="overflow"], nav, aside, div')
    : null;
  // phone frame: look for a container that is NOT the sidebar and holds the app content buttons (Get Started)
  const appBtn = Array.from(document.querySelectorAll('button,a')).find((e) =>
    /Get Started/.test(e.textContent || ''),
  );
  return {
    groupHeaderPath: pathOf(groupHeader),
    sidebarTag: sidebar
      ? sidebar.tagName + '.' + String(sidebar.className || '').slice(0, 50)
      : null,
    sidebarChildBtns: sidebar ? sidebar.querySelectorAll('button,a').length : 0,
    appBtnPath: pathOf(appBtn),
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await b.close();
