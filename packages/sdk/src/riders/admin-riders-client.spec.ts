import { describe, expect, it, vi } from 'vitest';

import { AdminRidersClient } from './admin-riders-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminRidersClient', () => {
  it('listRiders() gets /admin/riders with a serialized query and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.listRiders({ page: 2, limit: 20, status: 'PENDING' });

    expect(request).toHaveBeenCalledWith('/admin/riders?page=2&limit=20&status=PENDING', {
      method: 'GET',
      auth: true,
    });
  });

  it('listRiders() omits undefined query params (no query string when empty)', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.listRiders();

    expect(request).toHaveBeenCalledWith('/admin/riders', { method: 'GET', auth: true });
  });

  it('getRider() gets /admin/rider/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.getRider('rider-1');

    expect(request).toHaveBeenCalledWith('/admin/rider/rider-1', { method: 'GET', auth: true });
  });

  it('approveRider() posts /admin/rider/:id/approve with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.approveRider('rider-1');

    expect(request).toHaveBeenCalledWith('/admin/rider/rider-1/approve', {
      method: 'POST',
      auth: true,
    });
  });

  it('rejectRider() posts /admin/rider/:id/reject with the reason body', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.rejectRider('rider-1', 'Incomplete documents');

    expect(request).toHaveBeenCalledWith('/admin/rider/rider-1/reject', {
      method: 'POST',
      body: { reason: 'Incomplete documents' },
      auth: true,
    });
  });

  it('suspendRider() posts /admin/rider/:id/suspend with the reason body', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.suspendRider('rider-1', 'Policy breach');

    expect(request).toHaveBeenCalledWith('/admin/rider/rider-1/suspend', {
      method: 'POST',
      body: { reason: 'Policy breach' },
      auth: true,
    });
  });

  it('reactivateRider() posts /admin/rider/:id/reactivate with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminRidersClient(http);

    await client.reactivateRider('rider-1');

    expect(request).toHaveBeenCalledWith('/admin/rider/rider-1/reactivate', {
      method: 'POST',
      auth: true,
    });
  });
});
