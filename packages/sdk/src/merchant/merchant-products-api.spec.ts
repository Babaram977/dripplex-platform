import { describe, expect, it, vi } from 'vitest';

import { MerchantProductsApi } from './merchant-api.js';

import type { HttpClient } from '../client/http-client.js';
import type { ProductDto } from '@dripplex/types';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

const product = { id: 'prod_1' } as ProductDto;

describe('MerchantProductsApi', () => {
  it('list() builds a query string and skips empty values', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.list({ page: 1, pageSize: 20, status: 'PUBLISHED' });

    expect(request).toHaveBeenCalledWith('/merchant/products?page=1&pageSize=20&status=PUBLISHED', {
      method: 'GET',
      auth: true,
    });
  });

  it('list() omits the query string when called with no query', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.list();

    expect(request).toHaveBeenCalledWith('/merchant/products', { method: 'GET', auth: true });
  });

  it('get() fetches a single product by id', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(product);
    const api = new MerchantProductsApi(http);

    await expect(api.get('prod_1')).resolves.toBe(product);
    expect(request).toHaveBeenCalledWith('/merchant/products/prod_1', {
      method: 'GET',
      auth: true,
    });
  });

  it('create() posts the product payload', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);
    const body = { name: 'Widget', basePrice: 10, currency: 'NGN' };

    await api.create(body);

    expect(request).toHaveBeenCalledWith('/merchant/products', {
      method: 'POST',
      body,
      auth: true,
    });
  });

  it('update() patches the product', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);
    const body = { name: 'New name' };

    await api.update('prod_1', body);

    expect(request).toHaveBeenCalledWith('/merchant/products/prod_1', {
      method: 'PATCH',
      body,
      auth: true,
    });
  });

  it('remove() deletes the product', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.remove('prod_1');

    expect(request).toHaveBeenCalledWith('/merchant/products/prod_1', {
      method: 'DELETE',
      auth: true,
    });
  });

  it('publish() and unpublish() post to their respective endpoints', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.publish('prod_1');
    await api.unpublish('prod_1');

    expect(request).toHaveBeenNthCalledWith(1, '/merchant/products/prod_1/publish', {
      method: 'POST',
      auth: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/merchant/products/prod_1/unpublish', {
      method: 'POST',
      auth: true,
    });
  });

  it('addImage() and removeImage() manage product images', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.addImage('prod_1', { url: 'https://example.test/a.png' });
    await api.removeImage('prod_1', 'img_1');

    expect(request).toHaveBeenNthCalledWith(1, '/merchant/products/prod_1/images', {
      method: 'POST',
      body: { url: 'https://example.test/a.png' },
      auth: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/merchant/products/prod_1/images/img_1', {
      method: 'DELETE',
      auth: true,
    });
  });

  it('reorderImages() patches the ordered id list', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.reorderImages('prod_1', { imageIds: ['img_2', 'img_1'] });

    expect(request).toHaveBeenCalledWith('/merchant/products/prod_1/images/reorder', {
      method: 'PATCH',
      body: { imageIds: ['img_2', 'img_1'] },
      auth: true,
    });
  });

  it('createVariant(), updateVariant(), and removeVariant() manage variants', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);

    await api.createVariant('prod_1', { name: 'Large' });
    await api.updateVariant('prod_1', 'var_1', { isActive: false });
    await api.removeVariant('prod_1', 'var_1');

    expect(request).toHaveBeenNthCalledWith(1, '/merchant/products/prod_1/variants', {
      method: 'POST',
      body: { name: 'Large' },
      auth: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/merchant/products/prod_1/variants/var_1', {
      method: 'PATCH',
      body: { isActive: false },
      auth: true,
    });
    expect(request).toHaveBeenNthCalledWith(3, '/merchant/products/prod_1/variants/var_1', {
      method: 'DELETE',
      auth: true,
    });
  });

  it('updateInventory() patches the inventory payload', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantProductsApi(http);
    const body = { quantity: 5, lowStockAlert: 2, trackInventory: true };

    await api.updateInventory('prod_1', body);

    expect(request).toHaveBeenCalledWith('/merchant/products/prod_1/inventory', {
      method: 'PATCH',
      body,
      auth: true,
    });
  });
});
