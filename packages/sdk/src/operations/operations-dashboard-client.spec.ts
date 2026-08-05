import { describe, expect, it, vi } from 'vitest';

import { OperationsDashboardClient } from './operations-dashboard-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsDashboardClient', () => {
  it('getCounters() gets /operations/dashboard/counters with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsDashboardClient(http);

    await client.getCounters();

    expect(request).toHaveBeenCalledWith('/operations/dashboard/counters', {
      method: 'GET',
      auth: true,
    });
  });

  it('getActivityFeed() gets /operations/dashboard/activity-feed with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsDashboardClient(http);

    await client.getActivityFeed();

    expect(request).toHaveBeenCalledWith('/operations/dashboard/activity-feed', {
      method: 'GET',
      auth: true,
    });
  });
});
