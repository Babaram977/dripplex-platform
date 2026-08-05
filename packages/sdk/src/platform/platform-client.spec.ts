import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DripplexClient } from '../client/dripplex-client.js';

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('platform SDK clients', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true }))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wires platform namespaces on DripplexClient', () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    expect(client.notifications).toBeDefined();
    expect(client.devices).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.reviews).toBeDefined();
    expect(client.wishlist).toBeDefined();
    expect(client.promotions).toBeDefined();
    expect(client.loyalty).toBeDefined();
    expect(client.wallet).toBeDefined();
    expect(client.adminWallet).toBeDefined();
    expect(client.analytics).toBeDefined();
    expect(client.cms).toBeDefined();
    expect(client.adminCms).toBeDefined();
    expect(client.adminFraud).toBeDefined();
  });

  it('registers, lists, and deactivates device tokens on the customer route', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });
    const fetchMock = vi.mocked(fetch);

    await client.devices.register({ platform: 'ANDROID', token: 'tok-1' });
    const registerCall = fetchMock.mock.calls[0];
    expect(registerCall?.[0]).toBe('https://api.example.test/customer/devices');
    expect(registerCall?.[1]?.method).toBe('POST');

    await client.devices.list();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.example.test/customer/devices');

    await client.devices.deactivate('device-1');
    const deactivateCall = fetchMock.mock.calls[2];
    expect(deactivateCall?.[0]).toBe('https://api.example.test/customer/devices/device-1');
    expect(deactivateCall?.[1]?.method).toBe('DELETE');
  });

  it('calls public CMS routes without authorization', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.cms.page('about us');

    const fetchMock = vi.mocked(fetch);
    const url = fetchMock.mock.calls[0]?.[0];
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(url).toBe('https://api.example.test/cms/pages/about%20us');
    expect(init?.method).toBe('GET');
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('calls admin CMS schedule with auth and JSON body', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.adminCms.schedule('content-id', { scheduledAt: '2026-07-22T12:00:00.000Z' });

    const fetchMock = vi.mocked(fetch);
    const url = fetchMock.mock.calls[0]?.[0];
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(url).toBe('https://api.example.test/admin/cms/contents/content-id/schedule');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ scheduledAt: '2026-07-22T12:00:00.000Z' }));
    expect(headers?.['Authorization']).toBe('Bearer token');
  });

  it('builds admin fraud queue query strings', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.adminFraud.queue({ status: 'OPEN', riskLevel: 'HIGH', page: 2, pageSize: 10 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/admin/fraud/queue?status=OPEN&riskLevel=HIGH&page=2&pageSize=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('updates fraud thresholds through admin endpoints', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.adminFraud.upsertThreshold('score_high', { value: 75 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/admin/fraud/thresholds/score_high',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ value: 75 }),
      }),
    );
  });

  it('matches customer notification controller routes', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.notifications.list({ unreadOnly: true, page: 2, limit: 5 });
    await client.notifications.markRead('notification-id');
    await client.notifications.markAllRead();
    await client.notifications.preferences();
    await client.notifications.updatePreferences({
      preferences: [{ channel: 'EMAIL', type: 'PROMOTION', enabled: false }],
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/customer/notifications?unreadOnly=true&page=2&limit=5',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.example.test/customer/notifications/notification-id/read',
    );
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PATCH');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.example.test/customer/notifications/mark-all-read',
    );
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.example.test/customer/notifications/preferences',
    );
    expect(fetchMock.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          preferences: [{ channel: 'EMAIL', type: 'PROMOTION', enabled: false }],
        }),
      }),
    );
  });

  it('uses plural customer wishlist routes and item response endpoints', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.wishlist.list();
    await client.wishlist.create({ name: 'Favorites' });
    await client.wishlist.addItem('wishlist id', {
      itemType: 'PRODUCT',
      itemId: 'product-id',
    });
    await client.wishlist.moveToCart('wishlist id', { products: [] });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.test/customer/wishlists');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.example.test/customer/wishlists');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.example.test/customer/wishlists/wishlist%20id/items',
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.example.test/customer/wishlists/wishlist%20id/move-to-cart',
    );
  });

  it('calls authenticated search routes with backend query parameter names', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.search.search({
      q: 'rice',
      type: 'PRODUCT',
      page: 2,
      limit: 25,
      sort: 'price_asc',
      available: true,
    });
    await client.search.popular({ limit: 5 });

    const fetchMock = vi.mocked(fetch);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/search?q=rice&type=PRODUCT&page=2&limit=25&sort=price_asc&available=true',
    );
    expect(headers?.['Authorization']).toBe('Bearer token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.example.test/search/popular?limit=5');
  });

  it('lists reviews by query parameters on the public reviews route', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.reviews.listForTarget('PRODUCT', 'product-id', { page: 3, pageSize: 10 });

    const fetchMock = vi.mocked(fetch);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/reviews?targetType=PRODUCT&targetId=product-id&page=3&pageSize=10',
    );
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('redeems promotions with the backend order-based request body route', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.promotions.redeem({ couponCode: 'SAVE10', orderId: 'order-id' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/customer/promotions/redeem',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ couponCode: 'SAVE10', orderId: 'order-id' }),
      }),
    );
  });

  it('drives the admin promotions lifecycle/analytics/export routes', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.adminPromotions.create({ name: 'Flash Sale', type: 'PERCENTAGE', percentOff: 20 });
    await client.adminPromotions.list({ domain: 'RIDE' });
    await client.adminPromotions.pause('promo-id');
    await client.adminPromotions.resume('promo-id');
    await client.adminPromotions.archive('promo-id');
    await client.adminPromotions.forceExpire('promo-id');
    await client.adminPromotions.clone('promo-id', { code: 'CLONE10' });
    await client.adminPromotions.analytics('promo-id', { from: '2026-01-01' });
    await client.adminPromotions.topCampaigns();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.test/admin/promotions');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Flash Sale', type: 'PERCENTAGE', percentOff: 20 }),
      }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.example.test/admin/promotions?domain=RIDE',
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/pause',
    );
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/resume',
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/archive',
    );
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/force-expire',
    );
    expect(fetchMock.mock.calls[6]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/clone',
    );
    expect(fetchMock.mock.calls[6]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'CLONE10' }) }),
    );
    expect(fetchMock.mock.calls[7]?.[0]).toBe(
      'https://api.example.test/admin/promotions/promo-id/analytics?from=2026-01-01',
    );
    expect(fetchMock.mock.calls[8]?.[0]).toBe(
      'https://api.example.test/admin/promotions/analytics/top',
    );
    expect(client.adminPromotions.exportUrl('promo-id')).toBe('/admin/promotions/promo-id/export');
  });

  it('matches customer and admin wallet routes', async () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    await client.wallet.customerTransactions({ page: 2, pageSize: 10 });
    await client.wallet.transfer({ toUserId: 'recipient-id', amount: 500, currency: 'NGN' });
    await client.adminWallet.reconciliation({
      ownerType: 'CUSTOMER',
      ownerId: 'owner-id',
      currency: 'NGN',
    });
    await client.adminWallet.credit('CUSTOMER', 'owner-id', { amount: 250 });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/customer/wallet/transactions?page=2&pageSize=10',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.example.test/customer/wallet/transfer');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ toUserId: 'recipient-id', amount: 500, currency: 'NGN' }),
      }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.example.test/admin/wallets/reconciliation?ownerType=CUSTOMER&ownerId=owner-id&currency=NGN',
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'https://api.example.test/admin/wallets/CUSTOMER/owner-id/credit',
    );
  });

  it('calls the real merchant analytics overview route (DPX-MERCHANT-001 Phase 1 fix)', async () => {
    const client = new DripplexClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: () => 'token',
    });

    await client.analytics.merchant({ from: '2026-08-01', to: '2026-08-05', period: 'daily' });

    // MerchantAnalyticsController only ever exposed GET /merchant/analytics/overview
    // (apps/backend/src/analytics/merchant-analytics.controller.ts) — the prior
    // SDK method called a bare /merchant/analytics path that route never served.
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/merchant/analytics/overview?from=2026-08-01&to=2026-08-05&period=daily',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
