import { describe, expect, it, vi } from 'vitest';

import { DriverHelpClient } from './driver-help-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverHelpClient', () => {
  it('list() gets /driver/help with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverHelpClient(http).list();

    expect(request).toHaveBeenCalledWith('/driver/help', { method: 'GET', auth: true });
  });

  it('getBySlug() gets /driver/help/:slug with auth, url-encoded', async () => {
    const { http, request } = createHttpMock();
    await new DriverHelpClient(http).getBySlug('how do payouts work');

    expect(request).toHaveBeenCalledWith('/driver/help/how%20do%20payouts%20work', {
      method: 'GET',
      auth: true,
    });
  });
});
