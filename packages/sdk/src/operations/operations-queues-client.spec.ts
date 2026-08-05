import { describe, expect, it, vi } from 'vitest';

import { OperationsQueuesClient } from './operations-queues-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsQueuesClient', () => {
  it('getSosQueue() gets /operations/queues/sos with auth, no query when filter is empty', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsQueuesClient(http);

    await client.getSosQueue();

    expect(request).toHaveBeenCalledWith('/operations/queues/sos', { method: 'GET', auth: true });
  });

  it('getIncidentQueue() serializes filters into the query string', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsQueuesClient(http);

    await client.getIncidentQueue({ status: 'WAITING', priority: 'HIGH' });

    expect(request).toHaveBeenCalledWith(
      '/operations/queues/incidents?status=WAITING&priority=HIGH',
      { method: 'GET', auth: true },
    );
  });

  it('getSupportQueue() gets /operations/queues/support', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsQueuesClient(http);

    await client.getSupportQueue({ driverId: 'driver-1' });

    expect(request).toHaveBeenCalledWith('/operations/queues/support?driverId=driver-1', {
      method: 'GET',
      auth: true,
    });
  });
});
