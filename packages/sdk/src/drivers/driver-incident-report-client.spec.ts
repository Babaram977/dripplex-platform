import { describe, expect, it, vi } from 'vitest';

import { DriverIncidentReportClient } from './driver-incident-report-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverIncidentReportClient', () => {
  it('listOwn() gets /driver/incident-reports with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIncidentReportClient(http);

    await client.listOwn();

    expect(request).toHaveBeenCalledWith('/driver/incident-reports', {
      method: 'GET',
      auth: true,
    });
  });

  it('getOwn() gets /driver/incident-reports/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIncidentReportClient(http);

    await client.getOwn('report-1');

    expect(request).toHaveBeenCalledWith('/driver/incident-reports/report-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('create() posts to /driver/incident-reports with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIncidentReportClient(http);

    const body = {
      category: 'VEHICLE_BREAKDOWN' as const,
      severity: 'MEDIUM' as const,
      description: 'Flat tyre.',
    };
    await client.create(body);

    expect(request).toHaveBeenCalledWith('/driver/incident-reports', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
