import { ProxyAwareThrottlerGuard } from './proxy-aware-throttler.guard';

import type { Request } from 'express';

/**
 * Behind Railway's edge, `request.ip` is the proxy for every caller. Keying
 * rate limits on it put the whole platform in one bucket — twenty rider logins
 * from anywhere on earth exhausted `POST /auth/login/rider` and the next real
 * person was refused with 429. A rider hit exactly that on 2026-08-15: their
 * email verified (200) and the login one second later returned 429.
 *
 * These assert the tracker distinguishes callers, which is the whole fix.
 */
describe('ProxyAwareThrottlerGuard tracker', () => {
  // Only getTracker is under test; the guard's collaborators are never touched.
  const guard = Object.create(ProxyAwareThrottlerGuard.prototype) as {
    getTracker: (request: Request) => Promise<string>;
  };

  const request = (headers: Record<string, string | string[]>, ip = '100.64.0.5'): Request =>
    ({ headers, ip }) as unknown as Request;

  it('tracks the client, not the proxy — two users behind one edge are two buckets', async () => {
    const a = await guard.getTracker(
      request({ 'x-forwarded-for': '143.105.174.39, 46.151.193.241' }),
    );
    const b = await guard.getTracker(
      request({ 'x-forwarded-for': '102.91.5.211, 46.151.193.241' }),
    );

    expect(a).toBe('143.105.174.39');
    expect(b).toBe('102.91.5.211');
    // The bug in one line: these were equal, so one user's traffic spent
    // everybody else's allowance.
    expect(a).not.toBe(b);
  });

  it('falls back to x-real-ip when there is no forwarded chain', async () => {
    expect(await guard.getTracker(request({ 'x-real-ip': '102.91.5.211' }))).toBe('102.91.5.211');
  });

  it('falls back to the connection address when the proxy sends no headers', async () => {
    expect(await guard.getTracker(request({}, '198.51.100.7'))).toBe('198.51.100.7');
  });

  it('ignores an empty forwarded header rather than bucketing everyone under ""', async () => {
    expect(await guard.getTracker(request({ 'x-forwarded-for': '' }, '198.51.100.8'))).toBe(
      '198.51.100.8',
    );
  });

  it('handles a repeated header, taking the first hop', async () => {
    expect(
      await guard.getTracker(request({ 'x-forwarded-for': ['203.0.113.9, 10.0.0.1', '10.0.0.2'] })),
    ).toBe('203.0.113.9');
  });
});
