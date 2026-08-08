import { describe, expect, it, vi } from 'vitest';

import { AdminDriverIdentityVerificationClient } from './admin-driver-identity-verification-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriverIdentityVerificationClient', () => {
  it('require() posts to /admin/drivers/:id/identity-verification/require', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverIdentityVerificationClient(http).require('driver-1');
    expect(request).toHaveBeenCalledWith('/admin/drivers/driver-1/identity-verification/require', {
      method: 'POST',
      auth: true,
    });
  });

  it('unlock() posts to /admin/drivers/:id/identity-verification/unlock', async () => {
    const { http, request } = createHttpMock();
    await new AdminDriverIdentityVerificationClient(http).unlock('driver-1');
    expect(request).toHaveBeenCalledWith('/admin/drivers/driver-1/identity-verification/unlock', {
      method: 'POST',
      auth: true,
    });
  });
});
