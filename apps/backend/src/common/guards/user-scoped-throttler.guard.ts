import { Injectable } from '@nestjs/common';

import { ProxyAwareThrottlerGuard } from './proxy-aware-throttler.guard';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { Request } from 'express';

/**
 * Rate-limit per authenticated caller, falling back to the client IP.
 *
 * `ProxyAwareThrottlerGuard` keys on the address in X-Forwarded-For, and says
 * plainly why that is the best it can do: the header is caller-supplied, so a
 * determined attacker rotates it and widens their own limit. For an endpoint
 * reached only with a valid access token there is something better available —
 * the user id on the verified token, which the caller cannot forge.
 *
 * That matters on the wallet's recipient lookup specifically. It answers, for
 * any phone number or email address, whether an account exists and what that
 * person is called. An IP-keyed limit on a probe like that is a speed bump for
 * anyone willing to rotate a header; a user-keyed one costs an attacker a new
 * verified account per bucket.
 *
 * Two callers behind one NAT are two buckets here, which is also why this is
 * not simply folded into the parent guard for every route: this keys on
 * identity where identity exists, and inherits the parent's IP behaviour
 * everywhere else, including on the unauthenticated auth routes where there is
 * no user to key on.
 */
@Injectable()
export class UserScopedThrottlerGuard extends ProxyAwareThrottlerGuard {
  protected override async getTracker(request: Request): Promise<string> {
    const { user } = request as Request & { user?: AuthenticatedUser };
    if (user !== undefined && typeof user.id === 'string' && user.id.length > 0) {
      // Prefixed so a user id can never collide with an IP-keyed bucket.
      return `user:${user.id}`;
    }
    return await super.getTracker(request);
  }
}
