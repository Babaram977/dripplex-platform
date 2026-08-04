import { describe, expect, it, vi } from 'vitest';

import { DriverRideContactClient } from './driver-ride-contact-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverRideContactClient', () => {
  it('getActiveContact() gets /driver/ride-contact/active with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideContactClient(http);

    await client.getActiveContact();

    expect(request).toHaveBeenCalledWith('/driver/ride-contact/active', {
      method: 'GET',
      auth: true,
    });
  });
});
