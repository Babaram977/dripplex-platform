import { describe, expect, it, vi } from 'vitest';

import { OrderClient } from './order-client.js';

import type { HttpClient } from '../client/http-client.js';
import type { OrderExceptionDto, PaginatedResult } from '@dripplex/types';

/**
 * DPX-ORDER-8D-C ops visibility — the SDK contract for the exception queue.
 *
 * What is pinned here is the PATH, because the path is where this feature can
 * silently break. `admin/orders/exceptions` sits under a controller that also
 * declares `@Get(':id')`; the backend proves the route is reachable over real
 * HTTP in admin-order-exceptions.route.spec.ts, and this side pins that the SDK
 * asks for that exact URL rather than, say, `/admin/order-exceptions`. A typo
 * here produces a 404 no backend test can see.
 */

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

const page = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
} as PaginatedResult<OrderExceptionDto>;

describe('OrderClient — order exception queue', () => {
  it('OCE-001 · calls admin/orders/exceptions, authenticated', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(page);
    const client = new OrderClient(http);

    await expect(client.adminGetOrderExceptions()).resolves.toBe(page);
    expect(request).toHaveBeenCalledWith('/admin/orders/exceptions', {
      method: 'GET',
      auth: true,
    });
  });

  it('OCE-002 · sends the status and type filters', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.adminGetOrderExceptions({
      page: 2,
      pageSize: 50,
      status: 'OPEN',
      type: 'STALLED_CONFIRMED',
    });

    expect(request).toHaveBeenCalledWith(
      '/admin/orders/exceptions?page=2&pageSize=50&status=OPEN&type=STALLED_CONFIRMED',
      { method: 'GET', auth: true },
    );
  });

  it('OCE-003 · omits filters that were not given', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.adminGetOrderExceptions({ status: 'OPEN' });

    // An empty `type=` would be sent to the backend and rejected by the enum
    // validator, turning "no filter" into a 400.
    expect(request).toHaveBeenCalledWith('/admin/orders/exceptions?status=OPEN', {
      method: 'GET',
      auth: true,
    });
  });

  it('OCE-004 · exposes no method that acts on an exception', () => {
    // The ruling escalates a stalled order; it authorises nobody to act on one.
    // If a resolve/dismiss method is ever added, this should fail and send it
    // back for a ruling before a console can be built against it.
    const methods = Object.getOwnPropertyNames(OrderClient.prototype);
    const exceptionMethods = methods.filter((name) => /exception/i.test(name));

    expect(exceptionMethods).toEqual(['adminGetOrderExceptions']);
  });
});
