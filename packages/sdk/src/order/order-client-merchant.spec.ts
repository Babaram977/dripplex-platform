import { describe, expect, it, vi } from 'vitest';

import { OrderClient } from './order-client.js';

import type { HttpClient } from '../client/http-client.js';
import type { OrderDto, PaginatedResult } from '@dripplex/types';

/**
 * DPX-MERCHANT-001 Phase 1 — SDK coverage for `MerchantOrdersController`
 * (`apps/backend/src/orders/merchant-orders.controller.ts`), matching its
 * routes 1:1. Closes the gap `merchant-flow.e2e.spec.ts` previously
 * documented (no merchant order accept/prepare/ready endpoints on the
 * SDK); see DPX-MERCHANT-001-REALITY-AUDIT.md.
 */

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

const order = { id: 'order_1' } as OrderDto;
const page = {
  items: [order],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
} as PaginatedResult<OrderDto>;

describe('OrderClient — merchant order lifecycle', () => {
  it('merchantGetOrders() builds a query string and skips empty values', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(page);
    const client = new OrderClient(http);

    await expect(
      client.merchantGetOrders({ page: 1, pageSize: 20, status: 'PENDING' }),
    ).resolves.toBe(page);
    expect(request).toHaveBeenCalledWith('/merchant/orders?page=1&pageSize=20&status=PENDING', {
      method: 'GET',
      auth: true,
    });
  });

  it('merchantGetOrders() omits the query string when called with no query', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantGetOrders();

    expect(request).toHaveBeenCalledWith('/merchant/orders', { method: 'GET', auth: true });
  });

  it('merchantGetOrder() fetches a single order by id', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(order);
    const client = new OrderClient(http);

    await expect(client.merchantGetOrder('order_1')).resolves.toBe(order);
    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1', {
      method: 'GET',
      auth: true,
    });
  });

  it('merchantAcceptOrder() PATCHes with an optional estimatedReadyAt', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantAcceptOrder('order_1', { estimatedReadyAt: '2026-08-05T12:00:00.000Z' });

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/accept', {
      method: 'PATCH',
      body: { estimatedReadyAt: '2026-08-05T12:00:00.000Z' },
      auth: true,
    });
  });

  it('merchantAcceptOrder() defaults to an empty body', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantAcceptOrder('order_1');

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/accept', {
      method: 'PATCH',
      body: {},
      auth: true,
    });
  });

  it('merchantRejectOrder() PATCHes a required reason', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantRejectOrder('order_1', { reason: 'Out of stock' });

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/reject', {
      method: 'PATCH',
      body: { reason: 'Out of stock' },
      auth: true,
    });
  });

  it('merchantMarkOrderReady() PATCHes with no body', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantMarkOrderReady('order_1');

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/ready', {
      method: 'PATCH',
      auth: true,
    });
  });

  it('merchantDelayOrder() PATCHes a required estimatedReadyAt and optional reason', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantDelayOrder('order_1', {
      estimatedReadyAt: '2026-08-05T13:00:00.000Z',
      reason: 'Kitchen backlog',
    });

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/delay', {
      method: 'PATCH',
      body: { estimatedReadyAt: '2026-08-05T13:00:00.000Z', reason: 'Kitchen backlog' },
      auth: true,
    });
  });

  it('merchantCancelOrder() PATCHes an optional reason', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantCancelOrder('order_1', { reason: 'Customer requested' });

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/cancel', {
      method: 'PATCH',
      body: { reason: 'Customer requested' },
      auth: true,
    });
  });

  it('merchantCancelOrder() defaults to an empty body', async () => {
    const { http, request } = createHttpMock();
    const client = new OrderClient(http);

    await client.merchantCancelOrder('order_1');

    expect(request).toHaveBeenCalledWith('/merchant/orders/order_1/cancel', {
      method: 'PATCH',
      body: {},
      auth: true,
    });
  });
});
