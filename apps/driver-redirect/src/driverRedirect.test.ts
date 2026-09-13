import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import worker, { DRIVER_ENTRY_POINT } from './index';

/**
 * driver.dripplex.com must send every caller to the Super App's Driver login,
 * and must be incapable of doing anything else.
 *
 * The second half matters as much as the first. The hostname is only being
 * revived as a doorway; if this Worker could ever serve the retired Driver
 * Portal or the customer app, the 2026-08-30 decision would be undone by
 * accident rather than by choice. So the tests below check both the
 * destination and the absence of any means to reach an origin.
 */

const TARGET = 'https://app.dripplex.com/driver';

/** The founder's five cases, plus the old portal's real URL space. */
const OLD_PORTAL_PATHS = [
  '/',
  '/login',
  '/earnings',
  '/wallet',
  '/activity',
  '/campaign',
  '/help',
  '/history',
  '/incident',
  '/leaderboard',
  '/learn',
  '/onboarding',
  '/profile',
  '/rewards',
  '/shift',
  '/sos',
  '/support',
  '/trip',
];

const ODDITIES = [
  '/nonsense',
  '/deeply/nested/unknown/path',
  '/trailing/',
  '/login?next=%2Fearnings',
  '/wallet#fragment-never-reaches-the-server',
  '/%2e%2e/%2e%2e/etc/passwd',
  '/driver',
  '/DRIVER',
  '/' + 'a'.repeat(2000),
];

/**
 * The module's code with its comments removed.
 *
 * Written out properly rather than with a `//.*` regex, because this file is
 * about a URL — and `https://app.dripplex.com/driver` contains a `//` that a
 * naive stripper deletes along with the rest of the line. The first version of
 * this helper did exactly that and made two tests fail against correct code.
 */
function codeWithoutComments(source: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source.charAt(i);
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += source[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

const call = (path: string, init?: RequestInit): Response =>
  worker.fetch(new Request(`https://driver.dripplex.com${path}`, init));

describe('every old Driver Portal path lands on the Driver login', () => {
  it.each(OLD_PORTAL_PATHS)('%s → the Driver login', (path) => {
    const res = call(path);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(TARGET);
  });
});

describe('anything else lands there too', () => {
  it.each(ODDITIES)('%s → the Driver login', (path) => {
    const res = call(path);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(TARGET);
  });

  it('does not preserve the path, on purpose', () => {
    // Forwarding /earnings would resolve to app.dripplex.com/earnings, match
    // none of the Super App's five portal routes, fall through to its hostname
    // check, and strand a driver on the customer splash. Dropping the path is
    // the correct behaviour, so it is asserted rather than left to chance.
    const res = call('/earnings');
    expect(res.headers.get('location')).not.toContain('earnings');
  });

  it('answers every method the same way, including writes', () => {
    // A stale bookmark is a GET, but a stale form post or a preflight should
    // not fall through to some other behaviour.
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const res = call('/login', method === 'GET' || method === 'HEAD' ? {} : { method });
      expect(res.status, method).toBe(301);
      expect(res.headers.get('location'), method).toBe(TARGET);
    }
  });

  it('redirects permanently, not temporarily', () => {
    expect(call('/').status).toBe(301);
    expect(call('/').status).not.toBe(302);
  });
});

describe('it cannot serve the Driver Portal or the customer app', () => {
  const source = readFileSync(join(__dirname, 'index.ts'), 'utf8');

  it('carries no body at all', async () => {
    // Nothing to render means nothing that could ever be an application.
    expect(await call('/').text()).toBe('');
  });

  it('never reaches an origin', () => {
    // Proved by running it, not by grepping for the word `fetch` — the Worker
    // handler is itself called `fetch`, so a source search cannot tell the
    // export apart from an outbound call. Replacing the global and watching it
    // stay untouched can.
    const globals = globalThis as unknown as Record<string, unknown>;
    const original = globals.fetch;
    let reachedOut = 0;
    globals.fetch = (): never => {
      reachedOut += 1;
      throw new Error('the redirect Worker must never call out to an origin');
    };
    try {
      for (const path of ['/', '/login', '/earnings', '/wallet', '/anything']) {
        expect(call(path).status).toBe(301);
      }
    } finally {
      globals.fetch = original;
    }
    expect(reachedOut).toBe(0);
  });

  it('takes no environment or context it could reach an origin with', () => {
    // A redirect is the only value this module can produce because it is
    // handed nothing to obtain another with: the handler's signature is the
    // request alone — no `env`, no `ctx`.
    const code = codeWithoutComments(source);
    expect(code).not.toMatch(/\bASSETS\b/);
    expect(code).not.toMatch(/WORKER_SELF_REFERENCE/);
    expect(worker.fetch.length).toBe(1);
  });

  it('names no host but the Super App', () => {
    const code = codeWithoutComments(source);
    expect(code).toContain('app.dripplex.com');
    expect(code).not.toContain('driver.dripplex.com');
    expect(code).not.toContain('www.dripplex.com');
    expect(code).not.toMatch(/up\.railway\.app/);
  });

  it('declares no bindings in its Worker config', () => {
    // Belt and braces: the code cannot reach an origin, and the deployment
    // grants it nothing it could reach one with.
    const cfg = codeWithoutComments(readFileSync(join(__dirname, '../wrangler.jsonc'), 'utf8'));
    for (const binding of [
      'assets',
      'services',
      'images',
      'kv_namespaces',
      'r2_buckets',
      'd1_databases',
    ]) {
      expect(cfg, binding).not.toContain(`"${binding}"`);
    }
  });
});

describe('the destination is the one the Super App actually routes', () => {
  it('points at /driver, the Super App portal key', () => {
    // PORTAL_ROUTES in apps/super-app/src/app/App.tsx maps the path segment
    // "driver" to the drvlogin screen. If that key is ever renamed, this
    // redirect starts landing on the customer splash — so the two are pinned
    // together here rather than left to drift.
    expect(DRIVER_ENTRY_POINT).toBe(TARGET);
    expect(new URL(DRIVER_ENTRY_POINT).pathname).toBe('/driver');

    const app = readFileSync(join(__dirname, '../../super-app/src/app/App.tsx'), 'utf8');
    expect(app).toMatch(/const PORTAL_ROUTES[\s\S]{0,400}?\bdriver:\s*'drvlogin'/);
  });
});
