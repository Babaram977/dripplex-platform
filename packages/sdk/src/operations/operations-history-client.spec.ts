import { describe, expect, it, vi } from 'vitest';

import { OperationsHistoryClient } from './operations-history-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsHistoryClient', () => {
  it('gets each of the four domains on its own path, with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsHistoryClient(http);

    await client.getRideHistory();
    await client.getDeliveryHistory();
    await client.getOrderHistory();
    await client.getUtilityPurchaseHistory();

    for (const path of ['rides', 'deliveries', 'orders', 'utilities']) {
      expect(request).toHaveBeenCalledWith(`/operations/history/${path}`, {
        method: 'GET',
        auth: true,
      });
    }
  });

  it('serializes filters into the query string', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsHistoryClient(http);

    await client.getRideHistory({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-29T00:00:00.000Z',
      status: 'COMPLETED',
      search: '+2348012345678',
      page: 2,
      limit: 50,
    });

    const [url] = request.mock.calls[0] as [string];
    expect(url.startsWith('/operations/history/rides?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('status')).toBe('COMPLETED');
    // A phone number is the commonest way an enquiry arrives, and '+' has to
    // survive encoding or the search silently matches nothing.
    expect(params.get('search')).toBe('+2348012345678');
    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('50');
  });

  it('omits blank filters rather than sending empty values', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsHistoryClient(http);

    // The console clears its search box to an empty string; sending
    // `search=` would be a filter on nothing rather than no filter. An
    // absent key covers the other half — `exactOptionalPropertyTypes` means
    // an explicit `undefined` is not even expressible here.
    await client.getOrderHistory({ search: '' });

    expect(request).toHaveBeenCalledWith('/operations/history/orders', {
      method: 'GET',
      auth: true,
    });
  });
});
