import { describe, expect, it, vi } from 'vitest';

import { DriverSupportClient } from './driver-support-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverSupportClient', () => {
  it('listOwn() gets /driver/support-tickets with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSupportClient(http);

    await client.listOwn();

    expect(request).toHaveBeenCalledWith('/driver/support-tickets', { method: 'GET', auth: true });
  });

  it('getOwn() gets /driver/support-tickets/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSupportClient(http);

    await client.getOwn('ticket-1');

    expect(request).toHaveBeenCalledWith('/driver/support-tickets/ticket-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('create() posts to /driver/support-tickets with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSupportClient(http);

    const body = {
      category: 'PAYOUT' as const,
      subject: 'Missing payout',
      description: 'Details.',
    };
    await client.create(body);

    expect(request).toHaveBeenCalledWith('/driver/support-tickets', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
