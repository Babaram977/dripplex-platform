import { Test } from '@nestjs/testing';

import { AppConfigService } from '../../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

/**
 * R7 — the global rate limit is 500 requests / 60 s, keyed by client IP.
 * Founder ruling, 2026-09-15.
 *
 * These drive the running app over HTTP rather than asserting the configured
 * constant, because a configured value proves nothing about what the guard
 * enforces: the limit could be read from the wrong place, or the guard could
 * key on something other than the caller. Per CLAUDE.md §5 the behaviour is
 * proven by driving it and reading the response.
 *
 * The endpoint is an authenticated route that answers 401. That is deliberate:
 * ProxyAwareThrottlerGuard is registered BEFORE JwtAuthGuard, so a rejected
 * request still consumes budget — and using it avoids the 500 database round
 * trips that driving /health would cause.
 */
const LIMIT = 500;

/** RFC 5737 documentation addresses, so these can never collide with a real
 *  caller's bucket. */
const IP_A = '203.0.113.10';
const IP_B = '203.0.113.11';

/** Requires auth, touches no database. */
const PATH = '/integrations';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

jest.setTimeout(300_000);

suite('R7 · global rate limit (500 / 60 s, IP-keyed)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env['MERCHANT_MODULE_ENABLED'] = 'true';
    const { AppModule } = await import('../../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    // main.ts sets this prefix; without it the suite drives paths that do not
    // exist and proves nothing while passing.
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  /** One request from a given client address; returns the status code. */
  const hit = async (ip: string): Promise<number> => {
    const response = await fetch(`${baseUrl}${PATH}`, {
      method: 'GET',
      headers: { 'x-forwarded-for': ip },
    });
    return response.status;
  };

  it('permits 500 from one client IP, then refuses the 501st with 429', async () => {
    let throttledWithinLimit = 0;
    for (let i = 0; i < LIMIT; i += 1) {
      if ((await hit(IP_A)) === 429) throttledWithinLimit += 1;
    }

    // The 501st is the first request that may legitimately be refused.
    const overLimit = await hit(IP_A);

    expect({ throttledWithinLimit, overLimit }).toEqual({
      throttledWithinLimit: 0,
      overLimit: 429,
    });
  });

  it('keys the bucket by client IP — a second address is unaffected', async () => {
    // IP_A was exhausted by the test above and the throttler's storage is
    // in-memory and shared across this suite, so this asserts real isolation
    // rather than a freshly zeroed counter.
    expect(await hit(IP_A)).toBe(429);

    // A different caller must still be served. Every request in this suite
    // arrives over the same connection, so if the guard keyed on the
    // connection address — the defect ProxyAwareThrottlerGuard exists to fix —
    // this would be 429 too.
    expect(await hit(IP_B)).not.toBe(429);
  });
});
