import { describe, expect, it, vi } from 'vitest';

import { AdminDriverShiftsClient } from './admin-driver-shifts-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriverShiftsClient', () => {
  it('list() serializes the query and gets /admin/driver-shifts', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverShiftsClient(http).list({ page: 2, status: 'ACTIVE' });
    expect(request).toHaveBeenCalledWith('/admin/driver-shifts?page=2&status=ACTIVE', {
      method: 'GET',
      auth: true,
    });
  });

  it('list() omits the query string when empty', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverShiftsClient(http).list();
    expect(request).toHaveBeenCalledWith('/admin/driver-shifts', { method: 'GET', auth: true });
  });

  it('forceEnd() patches /admin/driver-shifts/:id/end with the body', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverShiftsClient(http).forceEnd('shift-1', {
      adminNotes: 'Abandoned overnight.',
    });
    expect(request).toHaveBeenCalledWith('/admin/driver-shifts/shift-1/end', {
      method: 'PATCH',
      body: { adminNotes: 'Abandoned overnight.' },
      auth: true,
    });
  });
});
