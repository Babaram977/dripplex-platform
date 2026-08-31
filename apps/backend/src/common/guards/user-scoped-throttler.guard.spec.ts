import { UserScopedThrottlerGuard } from './user-scoped-throttler.guard';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { Request } from 'express';

/**
 * The wallet's recipient lookup tells any caller whether an account exists for
 * a phone number or an address, and names the person it belongs to. Keyed on
 * the client IP that limit is a speed bump, because the parent guard reads the
 * address out of a caller-supplied header — rotate it and the bucket resets.
 * Keyed on the verified user id it costs an attacker a whole account.
 *
 * Only getTracker is exercised; the guard's collaborators are never touched.
 */
describe('UserScopedThrottlerGuard tracker', () => {
  const guard = Object.create(UserScopedThrottlerGuard.prototype) as {
    getTracker: (request: Request) => Promise<string>;
  };

  const request = (
    user: Partial<AuthenticatedUser> | undefined,
    headers: Record<string, string | string[]> = {},
    ip = '100.64.0.5',
  ): Request => ({ user, headers, ip }) as unknown as Request;

  it('keys on the authenticated user, so rotating the forwarded header does not reset the bucket', async () => {
    const a = await guard.getTracker(
      request({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { 'x-forwarded-for': '1.1.1.1' }),
    );
    const b = await guard.getTracker(
      request({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { 'x-forwarded-for': '2.2.2.2' }),
    );

    expect(a).toBe('user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    // The point of the guard: same caller, different claimed address, one bucket.
    expect(a).toBe(b);
  });

  it('gives two users behind one address two buckets', async () => {
    const a = await guard.getTracker(
      request({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, { 'x-forwarded-for': '1.1.1.1' }),
    );
    const b = await guard.getTracker(
      request({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, { 'x-forwarded-for': '1.1.1.1' }),
    );

    expect(a).not.toBe(b);
  });

  it('falls back to the parent IP tracker when there is no authenticated user', async () => {
    expect(
      await guard.getTracker(request(undefined, { 'x-forwarded-for': '143.105.174.39' })),
    ).toBe('143.105.174.39');
  });

  // A user id is prefixed, so it can never land in the same bucket as an
  // address that happens to be spelled the same way.
  it('namespaces the user bucket away from the IP buckets', async () => {
    const tracked = await guard.getTracker(request({ id: '1.1.1.1' }));

    expect(tracked).toBe('user:1.1.1.1');
    expect(tracked).not.toBe('1.1.1.1');
  });
});
