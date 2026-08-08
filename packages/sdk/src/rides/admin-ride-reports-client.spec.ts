import { describe, expect, it, vi } from 'vitest';

import { AdminRideReportsClient } from './admin-ride-reports-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminRideReportsClient', () => {
  it('list() gets /admin/ride-reports without a query when no status', async () => {
    const { http, request } = createHttpMock();
    await new AdminRideReportsClient(http).list();
    expect(request).toHaveBeenCalledWith('/admin/ride-reports', { method: 'GET', auth: true });
  });

  it('list() appends the status filter when provided', async () => {
    const { http, request } = createHttpMock();
    await new AdminRideReportsClient(http).list('OPEN');
    expect(request).toHaveBeenCalledWith('/admin/ride-reports?status=OPEN', {
      method: 'GET',
      auth: true,
    });
  });

  it('resolve() posts to /admin/ride-reports/:id/resolve with no body', async () => {
    const { http, request } = createHttpMock();
    await new AdminRideReportsClient(http).resolve('report-1');
    expect(request).toHaveBeenCalledWith('/admin/ride-reports/report-1/resolve', {
      method: 'POST',
      auth: true,
    });
  });
});
