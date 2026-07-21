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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wires platform namespaces on DripplexClient', () => {
    const client = new DripplexClient({ baseUrl: 'https://api.example.test' });

    expect(client.notifications).toBeDefined();
    expect(client.search).toBeDefined();
    expect(client.reviews).toBeDefined();
    expect(client.wishlist).toBeDefined();
    expect(client.promotions).toBeDefined();
    expect(client.loyalty).toBeDefined();
    expect(client.wallet).toBeDefined();
    expect(client.analytics).toBeDefined();
    expect(client.cms).toBeDefined();
    expect(client.adminCms).toBeDefined();
    expect(client.adminFraud).toBeDefined();
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
});
