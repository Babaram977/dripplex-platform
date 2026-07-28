import { describe, expect, it, vi } from 'vitest';

import { CustomerProductsApi } from './product-api.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('CustomerProductsApi', () => {
  it('browse() builds a query string from filters', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.browse({ categoryId: 'cat_1', sort: 'price_asc', limit: 10 });

    expect(request).toHaveBeenCalledWith('/products?categoryId=cat_1&sort=price_asc&limit=10', {
      method: 'GET',
      auth: false,
    });
  });

  it('browse() omits the query string when called with no filters', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.browse();

    expect(request).toHaveBeenCalledWith('/products', { method: 'GET', auth: false });
  });

  it('featured(), newArrivals(), trending(), and recommended() hit their preset endpoints', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.featured();
    await api.newArrivals();
    await api.trending();
    await api.recommended();

    expect(request).toHaveBeenNthCalledWith(1, '/products/featured', {
      method: 'GET',
      auth: false,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/products/new-arrivals', {
      method: 'GET',
      auth: false,
    });
    expect(request).toHaveBeenNthCalledWith(3, '/products/trending', {
      method: 'GET',
      auth: false,
    });
    expect(request).toHaveBeenNthCalledWith(4, '/products/recommended', {
      method: 'GET',
      auth: false,
    });
  });

  it('smartSearch() passes the raw query through', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.smartSearch({ query: 'Laptop under 500000' });

    expect(request).toHaveBeenCalledWith('/products/smart-search?query=Laptop+under+500000', {
      method: 'GET',
      auth: false,
    });
  });

  it('get() and similar() fetch a single product', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.get('prod_1');
    await api.similar('prod_1');

    expect(request).toHaveBeenNthCalledWith(1, '/products/prod_1', {
      method: 'GET',
      auth: false,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/products/prod_1/similar', {
      method: 'GET',
      auth: false,
    });
  });

  it('listCategories() and listBrands() hit their endpoints unauthenticated', async () => {
    const { http, request } = createHttpMock();
    const api = new CustomerProductsApi(http);

    await api.listCategories();
    await api.listBrands();

    expect(request).toHaveBeenNthCalledWith(1, '/categories', { method: 'GET', auth: false });
    expect(request).toHaveBeenNthCalledWith(2, '/brands', { method: 'GET', auth: false });
  });
});
