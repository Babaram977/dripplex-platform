import { chromium } from 'playwright-core';
import fs from 'node:fs';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2];
const APP = 'http://127.0.0.1:3006/';
// E2E_MINUTES caps the total crawl (default 10). E2E_GROUPS is an optional
// comma-separated substring filter to crawl only matching sidebar groups
// (e.g. E2E_GROUPS="Rider,Partner" to cover groups a prior budget cut off).
const DEADLINE = Date.now() + (Number(process.env.E2E_MINUTES) || 10) * 60 * 1000;
const GROUP_FILTER = (process.env.E2E_GROUPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
fs.mkdirSync(`${OUT}/videos`, { recursive: true });
const results = [];
const events = [];
const log = [];
const stamp = () => new Date().toISOString().slice(11, 23);
const rec = (m) => {
  const l = `[${stamp()}] ${m}`;
  log.push(l);
  console.log(l);
};
const writeReport = () => {
  const s = {
    screensTested: new Set(
      results.filter((r) => r.test === 'load').map((r) => r.group + '/' + r.screen),
    ).size,
    totalChecks: results.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    skip: results.filter((r) => r.status === 'SKIP').length,
  };
  fs.writeFileSync(
    `${OUT}/button-report.json`,
    JSON.stringify({ summary: s, results, errorEvents: events }, null, 2),
  );
  fs.writeFileSync(`${OUT}/test-log.txt`, log.join('\n'));
  return s;
};
let CURRENT = '(startup)';
let b, ctx, page;
try {
  b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${OUT}/videos`, size: { width: 1440, height: 900 } },
  });
  page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/favicon|DevTools|sourcemap|manifest/i.test(t))
        events.push({ ctx: CURRENT, kind: 'console.error', text: t.slice(0, 200) });
    }
  });
  page.on('pageerror', (e) =>
    events.push({ ctx: CURRENT, kind: 'pageerror', text: String(e.message).slice(0, 200) }),
  );
  page.on('response', (r) => {
    const s = r.status();
    if (s >= 400 && /\/api\//.test(r.url()))
      events.push({
        ctx: CURRENT,
        kind: 'http' + s,
        text: r.request().method() + ' ' + r.url().replace('http://127.0.0.1:3005', ''),
      });
  });
  await page.goto(APP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const groupHeaders = async () =>
    await page.$$eval('button', (bs) =>
      bs.map((b, i) => ({ i, t: (b.textContent || '').trim() })).filter((o) => /[▼▲]/.test(o.t)),
    );
  const clickIdx = async (i) => {
    const bs = await page.$$('button');
    if (bs[i]) {
      try {
        await bs[i].click({ timeout: 2500 });
        return true;
      } catch {}
    }
    return false;
  };
  const clickText = async (txt) => {
    const bs = await page.$$('button');
    for (const el of bs) {
      try {
        if ((await el.innerText()).trim() === txt) {
          await el.click({ timeout: 2500 });
          return true;
        }
      } catch {}
    }
    return false;
  };
  const groups = await groupHeaders();
  const groupNames = groups.map((x) => x.t.replace(/[▼▲]/g, '').trim());
  rec(`Found ${groups.length} sidebar groups: ${groupNames.join(', ')}`);
  for (const g of groups) {
    if (Date.now() > DEADLINE) {
      rec('TIME budget hit');
      break;
    }
    const gname = g.t.replace(/[▼▲]/g, '').trim();
    if (GROUP_FILTER.length && !GROUP_FILTER.some((f) => gname.includes(f))) continue;
    const findHdr = async () => {
      const hs = await groupHeaders();
      return hs.find((x) => x.t.replace(/[▼▲]/g, '').trim() === gname);
    };
    let h = await findHdr();
    if (!h) continue;
    if (/▼/.test(h.t)) {
      await clickIdx(h.i);
      await page.waitForTimeout(400);
    }
    let uniqLeaves = [];
    try {
      const leaves = await page.$$eval(
        'button',
        (bs, gn) =>
          bs
            .map((b) => (b.textContent || '').trim())
            .filter((t) => t && t.length <= 32 && !/[▼▲]/.test(t) && !gn.includes(t)),
        groupNames,
      );
      uniqLeaves = [...new Set(leaves)];
    } catch (e) {
      rec(`[${gname}] leaf-enum error ${e.message}`);
    }
    rec(`[${gname}] ${uniqLeaves.length} screens`);
    const sideText = new Set([...groupNames, ...uniqLeaves]);
    for (const leaf of uniqLeaves) {
      if (Date.now() > DEADLINE) break;
      CURRENT = `${gname}/${leaf}`;
      try {
        h = await findHdr();
        if (h && /▼/.test(h.t)) {
          await clickIdx(h.i);
          await page.waitForTimeout(300);
        }
        const before = events.length;
        const navd = await clickText(leaf);
        await page.waitForTimeout(450);
        const loadErr = events.slice(before);
        const fn = `${OUT}/screenshots/${String(results.filter((r) => r.test === 'load').length + 1).padStart(3, '0')}-${gname.replace(/[^a-z0-9]+/gi, '')}-${leaf.replace(/[^a-z0-9]+/gi, '_').slice(0, 16)}.png`;
        try {
          await page.screenshot({ path: fn });
        } catch {}
        results.push({
          group: gname,
          screen: leaf,
          test: 'load',
          status: !navd ? 'SKIP' : loadErr.length ? 'FAIL' : 'PASS',
          errors: loadErr,
        });
        if (loadErr.length)
          rec(`   FAIL load [${gname}/${leaf}] ${loadErr.map((e) => e.kind).join(',')}`);
        // app buttons
        let appTexts = [];
        try {
          appTexts = await page.$$eval('button,[role=button]', (els) =>
            els.map((e) => (e.textContent || '').trim()),
          );
        } catch {}
        const targets = [
          ...new Set(
            appTexts.filter((t) => t && t.length <= 40 && !/[▼▲]/.test(t) && !sideText.has(t)),
          ),
        ].slice(0, 5);
        for (const bt of targets) {
          if (Date.now() > DEADLINE) break;
          CURRENT = `${gname}/${leaf} » ${bt}`;
          try {
            h = await findHdr();
            if (h && /▼/.test(h.t)) {
              await clickIdx(h.i);
              await page.waitForTimeout(200);
            }
            await clickText(leaf);
            await page.waitForTimeout(250);
            const b0 = events.length;
            const clicked = await clickText(bt);
            await page.waitForTimeout(400);
            const errs = events.slice(b0);
            results.push({
              group: gname,
              screen: leaf,
              test: 'button:' + bt,
              status: !clicked ? 'SKIP' : errs.length ? 'FAIL' : 'PASS',
              errors: errs,
            });
            if (errs.length)
              rec(`      FAIL btn [${gname}/${leaf}] "${bt}" ${errs.map((e) => e.kind).join(',')}`);
          } catch (e) {
            results.push({
              group: gname,
              screen: leaf,
              test: 'button:' + bt,
              status: 'SKIP',
              note: e.message.slice(0, 80),
            });
          }
        }
      } catch (e) {
        rec(`   ERROR [${gname}/${leaf}] ${e.message.slice(0, 100)}`);
        results.push({
          group: gname,
          screen: leaf,
          test: 'load',
          status: 'SKIP',
          note: e.message.slice(0, 80),
        });
      }
    }
    writeReport(); // checkpoint after each group
  }
} catch (e) {
  rec(`FATAL ${e.message}`);
} finally {
  const s = writeReport();
  rec(`DONE ${JSON.stringify(s)}`);
  try {
    await ctx?.close();
  } catch {}
  try {
    await b?.close();
  } catch {}
  console.log('SUMMARY', JSON.stringify(s));
}
