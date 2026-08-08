import { describe, expect, it, vi } from 'vitest';

import { AdminIncidentReportsClient } from './admin-incident-reports-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminIncidentReportsClient', () => {
  it('list() gets /admin/incident-reports with serialized status/severity filters', async () => {
    const { http, request } = createHttpMock();
    await new AdminIncidentReportsClient(http).list({ status: 'OPEN', severity: 'HIGH' });
    expect(request).toHaveBeenCalledWith('/admin/incident-reports?status=OPEN&severity=HIGH', {
      method: 'GET',
      auth: true,
    });
  });

  it('update() patches /admin/incident-reports/:id with the body', async () => {
    const { http, request } = createHttpMock();
    await new AdminIncidentReportsClient(http).update('incident-1', {
      status: 'RESOLVED',
      adminNotes: 'Reviewed CCTV.',
    });
    expect(request).toHaveBeenCalledWith('/admin/incident-reports/incident-1', {
      method: 'PATCH',
      body: { status: 'RESOLVED', adminNotes: 'Reviewed CCTV.' },
      auth: true,
    });
  });
});
