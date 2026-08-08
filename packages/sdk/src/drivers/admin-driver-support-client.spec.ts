import { describe, expect, it, vi } from 'vitest';

import { AdminDriverSupportClient } from './admin-driver-support-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriverSupportClient', () => {
  it('list() gets /admin/driver-support-tickets with a serialized status filter', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverSupportClient(http).list({ status: 'OPEN' });
    expect(request).toHaveBeenCalledWith('/admin/driver-support-tickets?status=OPEN', {
      method: 'GET',
      auth: true,
    });
  });

  it('update() patches /admin/driver-support-tickets/:id with the body', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverSupportClient(http).update('ticket-1', {
      status: 'RESOLVED',
      adminResponse: 'Handled.',
    });
    expect(request).toHaveBeenCalledWith('/admin/driver-support-tickets/ticket-1', {
      method: 'PATCH',
      body: { status: 'RESOLVED', adminResponse: 'Handled.' },
      auth: true,
    });
  });
});
