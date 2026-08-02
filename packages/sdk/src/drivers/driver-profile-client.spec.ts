import { describe, expect, it, vi } from 'vitest';

import { DriverProfileClient } from './driver-profile-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverProfileClient', () => {
  it('getOwnProfile() gets /driver/profile with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverProfileClient(http);

    await client.getOwnProfile();

    expect(request).toHaveBeenCalledWith('/driver/profile', { method: 'GET', auth: true });
  });

  it('submitKyc() posts to /driver/kyc with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverProfileClient(http);

    const body = {
      documentType: 'DRIVER_LICENSE' as const,
      documentNumber: 'DL-12345',
      frontImage: 'https://cdn.example/front.jpg',
    };
    await client.submitKyc(body);

    expect(request).toHaveBeenCalledWith('/driver/kyc', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
