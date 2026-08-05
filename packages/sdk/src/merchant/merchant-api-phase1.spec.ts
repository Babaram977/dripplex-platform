import { describe, expect, it, vi } from 'vitest';

import { MerchantApi } from './merchant-api.js';

import type { HttpClient } from '../client/http-client.js';
import type { BusinessDto } from '@dripplex/types';

/**
 * DPX-MERCHANT-001 Phase 1 — SDK coverage for store pause/resume, matching
 * `MerchantController`'s `POST /merchant/business/pause|resume` 1:1. Real
 * backend capability with zero prior SDK coverage; see
 * DPX-MERCHANT-001-REALITY-AUDIT.md.
 */

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

const business = { id: 'biz_1' } as BusinessDto;

describe('MerchantApi — store pause/resume', () => {
  it('pauseStore() posts an optional reason', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(business);
    const api = new MerchantApi(http);

    await expect(api.pauseStore({ reason: 'Stocktaking' })).resolves.toBe(business);
    expect(request).toHaveBeenCalledWith('/merchant/business/pause', {
      method: 'POST',
      body: { reason: 'Stocktaking' },
      auth: true,
    });
  });

  it('pauseStore() defaults to an empty body when no reason is given', async () => {
    const { http, request } = createHttpMock();
    const api = new MerchantApi(http);

    await api.pauseStore();

    expect(request).toHaveBeenCalledWith('/merchant/business/pause', {
      method: 'POST',
      body: {},
      auth: true,
    });
  });

  it('resumeStore() posts with no body', async () => {
    const { http, request } = createHttpMock();
    request.mockResolvedValueOnce(business);
    const api = new MerchantApi(http);

    await expect(api.resumeStore()).resolves.toBe(business);
    expect(request).toHaveBeenCalledWith('/merchant/business/resume', {
      method: 'POST',
      auth: true,
    });
  });
});
