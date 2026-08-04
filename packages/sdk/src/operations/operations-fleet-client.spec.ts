import { describe, expect, it, vi } from 'vitest';

import { OperationsFleetClient } from './operations-fleet-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsFleetClient', () => {
  it('getSnapshot() gets /operations/fleet with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsFleetClient(http);

    await client.getSnapshot();

    expect(request).toHaveBeenCalledWith('/operations/fleet', { method: 'GET', auth: true });
  });
});
