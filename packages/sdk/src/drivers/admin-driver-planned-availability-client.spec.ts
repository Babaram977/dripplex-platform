import { describe, expect, it, vi } from 'vitest';

import { AdminDriverPlannedAvailabilityClient } from './admin-driver-planned-availability-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriverPlannedAvailabilityClient', () => {
  it('list() gets /admin/driver-planned-availability with the driverId query and auth', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverPlannedAvailabilityClient(http).list('driver-1');
    expect(request).toHaveBeenCalledWith('/admin/driver-planned-availability?driverId=driver-1', {
      method: 'GET',
      auth: true,
    });
  });
});
