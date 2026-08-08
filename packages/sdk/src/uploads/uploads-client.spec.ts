import { describe, expect, it, vi } from 'vitest';

import { UploadsClient } from './uploads-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('UploadsClient', () => {
  it('sign() posts the request to /uploads/sign with auth', async () => {
    const { http, request } = createHttpMock();
    await new UploadsClient(http).sign({
      contentType: 'application/pdf',
      folder: 'kyc-documents',
      contentLength: 1024,
    });
    expect(request).toHaveBeenCalledWith('/uploads/sign', {
      method: 'POST',
      body: { contentType: 'application/pdf', folder: 'kyc-documents', contentLength: 1024 },
      auth: true,
    });
  });
});
