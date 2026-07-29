import { describe, expect, it, vi } from 'vitest';

import { CustomerMerchantsApi } from './merchant-api.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('CustomerMerchantsApi', () => {
  it('browse() builds a query string from filters', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerMerchantsApi(http);

    await api.browse({ businessType: 'CORPORATION', sort: 'nearest', lat: 6.5, lng: 3.3 });

    expect(request).toHaveBeenCalledWith(
      '/merchants?businessType=CORPORATION&sort=nearest&lat=6.5&lng=3.3',
      { method: 'GET', auth: false },
    );
  });

  it('browse() omits the query string when called with no filters', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerMerchantsApi(http);

    await api.browse();

    expect(request).toHaveBeenCalledWith('/merchants', { method: 'GET', auth: false });
  });

  it('smartSearch() passes the raw query through unauthenticated', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerMerchantsApi(http);

    await api.smartSearch({ query: 'Best shawarma near me' });

    expect(request).toHaveBeenCalledWith('/merchants/smart-search?query=Best+shawarma+near+me', {
      method: 'GET',
      auth: false,
    });
  });

  it('get() fetches a single merchant, including location when given', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerMerchantsApi(http);

    await api.get('merchant_1');
    await api.get('merchant_1', { lat: 6.5, lng: 3.3 });

    expect(request).toHaveBeenNthCalledWith(1, '/merchants/merchant_1', {
      method: 'GET',
      auth: false,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/merchants/merchant_1?lat=6.5&lng=3.3', {
      method: 'GET',
      auth: false,
    });
  });
});
