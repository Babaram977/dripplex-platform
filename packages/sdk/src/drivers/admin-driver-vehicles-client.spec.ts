import { describe, expect, it, vi } from 'vitest';

import { AdminDriverVehiclesClient } from './admin-driver-vehicles-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriverVehiclesClient', () => {
  it('list() gets /admin/vehicles with auth (no query when empty)', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriverVehiclesClient(http);

    await client.list();

    expect(request).toHaveBeenCalledWith('/admin/vehicles', { method: 'GET', auth: true });
  });

  it('list() serializes the approvalStatus filter', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriverVehiclesClient(http);

    await client.list({ approvalStatus: 'PENDING' });

    expect(request).toHaveBeenCalledWith('/admin/vehicles?approvalStatus=PENDING', {
      method: 'GET',
      auth: true,
    });
  });

  it('approve() posts to /admin/vehicles/:id/approve with no body and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriverVehiclesClient(http);

    await client.approve('veh-1');

    expect(request).toHaveBeenCalledWith('/admin/vehicles/veh-1/approve', {
      method: 'POST',
      auth: true,
    });
  });

  it('reject() posts to /admin/vehicles/:id/reject with a rejectedReason body', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriverVehiclesClient(http);

    await client.reject('veh-1', 'Plate does not match documents.');

    expect(request).toHaveBeenCalledWith('/admin/vehicles/veh-1/reject', {
      method: 'POST',
      body: { rejectedReason: 'Plate does not match documents.' },
      auth: true,
    });
  });
});
