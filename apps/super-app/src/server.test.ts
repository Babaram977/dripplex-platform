// @vitest-environment node
/**
 * Guards the one path `serve` cannot serve.
 *
 * Apple authorises a Universal Link by fetching
 * `/.well-known/apple-app-site-association` — exactly that path, no extension,
 * no redirect. `serve` answers it with the SPA's index.html under HTTP 200, so
 * the file can be committed and deployed and still be rejected by Apple while
 * every check a human would run reports success.
 *
 * These tests fail if anyone reverts the runner to the `serve` CLI, and the
 * regression cases below fail if the replacement quietly changes anything else
 * — particularly the cache policy `serve.json` exists to enforce.
 */
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AASA_ROUTE, createApp } from '../server.mjs';

const AASA_BODY = JSON.stringify({
  applinks: { details: [{ appIDs: ['TESTTEAM.com.dripplex.customer'], components: [] }] },
});

let root: string;
let server: Server;
let origin: string;

/** Boots the real server over a fixture tree, using the real serve.json. */
async function boot(withAasa: boolean) {
  root = await mkdtemp(join(tmpdir(), 'dpx-super-app-'));
  await mkdir(join(root, 'dist', '.well-known'), { recursive: true });
  await mkdir(join(root, 'dist', 'assets'), { recursive: true });
  await copyFile(join(process.cwd(), 'serve.json'), join(root, 'serve.json'));
  await writeFile(join(root, 'dist', 'index.html'), '<html>SPA</html>');
  await writeFile(join(root, 'dist', 'assets', 'main-abc123.css'), 'body{}');
  await writeFile(join(root, 'dist', '.well-known', 'assetlinks.json'), '[{"relation":[]}]');
  if (withAasa) {
    await writeFile(join(root, 'dist', '.well-known', 'apple-app-site-association'), AASA_BODY);
  }
  server = await createApp(root);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('no port');
  origin = `http://127.0.0.1:${address.port}`;
}

async function shutdown() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(root, { recursive: true, force: true });
}

describe('apple-app-site-association is published', () => {
  beforeAll(() => boot(true));
  afterAll(shutdown);

  it('serves the extensionless path as application/json', async () => {
    const res = await fetch(`${origin}${AASA_ROUTE}`);

    expect(res.status).toBe(200);
    // The whole point. `serve` returns text/html here.
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual(JSON.parse(AASA_BODY));
  });

  it('does not fall through to the SPA', async () => {
    const body = await (await fetch(`${origin}${AASA_ROUTE}`)).text();

    expect(body).not.toContain('<html');
  });

  it('is cacheable but not pinned, so a Team ID correction propagates', async () => {
    const res = await fetch(`${origin}${AASA_ROUTE}`);

    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  // Regressions. Everything below this line behaved correctly under `serve`
  // and must still behave correctly now that serve-handler is called directly.
  it('still serves the Android assetlinks.json', async () => {
    const res = await fetch(`${origin}/.well-known/assetlinks.json`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('still falls back to the SPA for client-side routes', async () => {
    const res = await fetch(`${origin}/merchant/orders/123`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SPA');
  });

  it('still sends index.html as no-cache', async () => {
    const res = await fetch(`${origin}/`);

    // Without this a browser holds index.html heuristically and stays pinned to
    // an old hashed bundle after a deploy has landed.
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('still sends hashed assets as immutable', async () => {
    const res = await fetch(`${origin}/assets/main-abc123.css`);

    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});

describe('apple-app-site-association is absent', () => {
  beforeAll(() => boot(false));
  afterAll(shutdown);

  it('404s rather than serving the SPA under a 200', async () => {
    const res = await fetch(`${origin}${AASA_ROUTE}`);

    // A 200 carrying index.html is how this failure hides. An honest 404 is
    // debuggable; a plausible 200 is not.
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.text()).not.toContain('<html');
  });
});
