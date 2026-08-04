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
});
