import { describe, expect, it, vi } from 'vitest';

import { AdminSosAlertsClient } from './admin-sos-alerts-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminSosAlertsClient', () => {
  it('list() gets /admin/sos-alerts with a serialized status filter', async () => {
    const { http, request } = createHttpMock();
    await new AdminSosAlertsClient(http).list({ status: 'OPEN' });
    expect(request).toHaveBeenCalledWith('/admin/sos-alerts?status=OPEN', {
      method: 'GET',
      auth: true,
    });
  });

  it('update() patches /admin/sos-alerts/:id with the body', async () => {
    const { http, request } = createHttpMock();
    await new AdminSosAlertsClient(http).update('sos-1', {
      status: 'RESOLVED',
      adminNotes: 'Contacted driver, false alarm.',
    });
    expect(request).toHaveBeenCalledWith('/admin/sos-alerts/sos-1', {
      method: 'PATCH',
      body: { status: 'RESOLVED', adminNotes: 'Contacted driver, false alarm.' },
      auth: true,
    });
  });
});
