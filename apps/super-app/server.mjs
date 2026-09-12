#!/usr/bin/env node
/**
 * Static server for the DrippleX Super App.
 *
 * This exists for exactly one path. Everything else is delegated, unchanged, to
 * `serve-handler` — the same library `serve` itself is a CLI wrapper around, at
 * the same version `serve@14` pins (6.1.6) — reading the same `serve.json`. So
 * routing, SPA fallback and the cache policy behave as they did before.
 *
 * WHY THIS FILE EXISTS
 *
 * Apple authorises a Universal Link by fetching
 *
 *   https://app.dripplex.com/.well-known/apple-app-site-association
 *
 * and the path must be exactly that: no `.json`, no redirect. Apple does not
 * follow redirects for this file, and will not accept a renamed one.
 *
 * `serve` will not serve that file. Measured 2026-09-12 with the file
 * physically present in `dist/.well-known/`, against every configuration:
 *
 *   serve -s dist --config serve.json   (production)  -> 200 text/html, the SPA
 *   serve dist --config serve.json      (no -s)       -> 200 text/html, the SPA
 *   serve -s dist                       (no config)   -> 200 text/html, the SPA
 *   serve dist                          (bare)        -> 200 text/html, the SPA
 *   + cleanUrls:false + explicit Content-Type header  -> 200 text/html, the SPA
 *
 * `.well-known/assetlinks.json` — the Android equivalent, same directory —
 * returned 200 application/json in every one of those runs, and deep SPA routes
 * kept resolving. The isolated variable is the absent file extension.
 *
 * The failure is silent: HTTP 200, a plausible body, and Apple rejecting it.
 * Committing the file and deploying it would have looked like success from
 * every angle except a real device. That is the same shape as the iOS
 * entitlements file that was wired to nothing and the GEOCODER that sat at
 * undefined in production. A 200 is not a pass.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import handler from 'serve-handler';

/** Apple's required path. Not configurable — Apple defines it. */
export const AASA_ROUTE = '/.well-known/apple-app-site-association';

/**
 * @param {string} root directory holding `dist/` and `serve.json`.
 *   Injectable so the test can run against a fixture instead of a build
 *   artifact — a test that needs `pnpm build` to have run first is a test that
 *   gets skipped.
 */
export async function createApp(root = process.cwd()) {
  const dist = join(root, 'dist');
  const aasaFile = join(dist, '.well-known', 'apple-app-site-association');
  const config = JSON.parse(await readFile(join(root, 'serve.json'), 'utf8'));

  return createServer(async (req, res) => {
    if ((req.url ?? '').split('?')[0] === AASA_ROUTE) {
      let body;
      try {
        body = await readFile(aasaFile);
      } catch {
        // 404 on purpose. The alternative is the SPA's index.html under a 200,
        // which is the exact failure this file exists to prevent: it reads as
        // working from everywhere except a real device.
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'apple-app-site-association is not published' }));
        return;
      }
      // Apple requires application/json. Apple's CDN caches it, so a short
      // max-age keeps a Team ID correction from taking a day to propagate.
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(body);
      return;
    }
    await handler(req, res, { public: dist, ...config });
  });
}

if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['PORT'] ?? 3000);
  const app = await createApp();
  app.listen(port, () => console.log(`super-app listening on ${port}`));
}
