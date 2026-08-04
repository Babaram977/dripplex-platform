import { describe, expect, it, vi } from 'vitest';

import { DriverIdentityVerificationClient } from './driver-identity-verification-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverIdentityVerificationClient', () => {
  it('getStatus() gets /driver/identity-verification/status with no query when deviceId omitted', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIdentityVerificationClient(http);

    await client.getStatus();

    expect(request).toHaveBeenCalledWith('/driver/identity-verification/status', {
      method: 'GET',
      auth: true,
    });
  });

  it('getStatus() includes deviceId as a query param when provided', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIdentityVerificationClient(http);

    await client.getStatus('device-a');

    expect(request).toHaveBeenCalledWith('/driver/identity-verification/status?deviceId=device-a', {
      method: 'GET',
      auth: true,
    });
  });

  it('submit() posts to /driver/identity-verification/submit with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverIdentityVerificationClient(http);

    const body = { selfieImageBase64: 'x'.repeat(200), deviceId: 'device-a' };
    await client.submit(body);

    expect(request).toHaveBeenCalledWith('/driver/identity-verification/submit', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
