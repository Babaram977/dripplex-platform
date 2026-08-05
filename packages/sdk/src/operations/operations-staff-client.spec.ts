import { describe, expect, it, vi } from 'vitest';

import { OperationsStaffClient } from './operations-staff-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsStaffClient', () => {
  it('list() gets /operations/staff with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsStaffClient(http);

    await client.list();

    expect(request).toHaveBeenCalledWith('/operations/staff', { method: 'GET', auth: true });
  });
});
