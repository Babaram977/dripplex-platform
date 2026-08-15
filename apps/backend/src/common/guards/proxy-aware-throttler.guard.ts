import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { Request } from 'express';

/**
 * Rate-limit per real client, not per proxy.
 *
 * The API runs behind Railway's edge, so `request.ip` is the proxy's address
 * (100.64.0.0/10), identical for every visitor. The stock ThrottlerGuard keys
 * its counters on that value, which put the ENTIRE PLATFORM in one bucket:
 * `POST /auth/login/rider` allows 20 per minute, so twenty rider logins from
 * anywhere on earth exhausted it and the twenty-first real person got a 429.
 *
 * That is not theoretical. A rider registering on 2026-08-15 verified their
 * email successfully (200) and was then refused login with 429 on the very
 * next request — their first attempt of the evening. Reproduced locally: 25
 * logins carrying 25 different X-Forwarded-For addresses returned 401 twenty
 * times and then 429, proving the addresses were never distinguished.
 *
 * The client IP is resolved exactly the way every controller's audit context
 * already resolves it — leftmost X-Forwarded-For entry, then the connection
 * address — so throttling and audit records agree on who a caller is.
 *
 * Trade-off, deliberately accepted: X-Forwarded-For is caller-supplied, so a
 * determined attacker can rotate the header to widen their own limit. That is
 * strictly better than today, where they cannot avoid locking out every other
 * user. Credential stuffing has a second, header-proof defence regardless:
 * LoginAttemptService locks on the identifier itself. If the edge is later
 * fronted by something that guarantees a trustworthy client address, key on
 * that instead.
 */
@Injectable()
export class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: Request): Promise<string> {
    const forwarded = request.headers['x-forwarded-for'];
    const firstForwarded =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : Array.isArray(forwarded)
          ? forwarded[0]?.split(',')[0]?.trim()
          : undefined;

    const realIp = request.headers['x-real-ip'];
    const fallbackRealIp = typeof realIp === 'string' ? realIp.trim() : undefined;

    return await Promise.resolve(
      firstForwarded !== undefined && firstForwarded.length > 0
        ? firstForwarded
        : ((fallbackRealIp !== undefined && fallbackRealIp.length > 0
            ? fallbackRealIp
            : request.ip) ?? 'unknown'),
    );
  }
}
