import { describe, expect, it, vi } from 'vitest';

import { OperationsRidesClient } from './operations-rides-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsRidesClient', () => {
  it('getQueue() gets /operations/rides with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsRidesClient(http);

    await client.getQueue();

    expect(request).toHaveBeenCalledWith('/operations/rides', { method: 'GET', auth: true });
  });

  it('getRideDetail() gets /operations/rides/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsRidesClient(http);

    await client.getRideDetail('ride-1');

    expect(request).toHaveBeenCalledWith('/operations/rides/ride-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('getRideAllocation() gets /operations/rides/:id/allocation with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsRidesClient(http);

    await client.getRideAllocation('ride-1');

    expect(request).toHaveBeenCalledWith('/operations/rides/ride-1/allocation', {
      method: 'GET',
      auth: true,
    });
  });

  it('getTripTracking() gets /operations/rides/:id/tracking with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsRidesClient(http);

    await client.getTripTracking('ride-1');

    expect(request).toHaveBeenCalledWith('/operations/rides/ride-1/tracking', {
      method: 'GET',
      auth: true,
    });
  });

  it('getDispatchCandidates() gets /operations/rides/:id/dispatch-candidates with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsRidesClient(http);

    await client.getDispatchCandidates('ride-1');

    expect(request).toHaveBeenCalledWith('/operations/rides/ride-1/dispatch-candidates', {
      method: 'GET',
      auth: true,
    });
  });
});
