import type { HttpClient } from '../client/http-client.js';
import type { SignUploadRequest, SignUploadResponse } from '@dripplex/types';

/**
 * DPX-DRIVER-016 — signed direct-to-storage uploads for UploadsController
 * (apps/backend/src/uploads/uploads.controller.ts). Cross-cutting: any
 * authenticated user may request a short-lived pre-signed PUT URL scoped to a
 * key under their own user id. Upload the bytes to `uploadUrl`, then submit the
 * returned `publicUrl`/`key` through the relevant feature contract.
 */
export class UploadsClient {
  public constructor(private readonly http: HttpClient) {}

  public sign(body: SignUploadRequest): Promise<SignUploadResponse> {
    return this.http.request<SignUploadResponse>('/uploads/sign', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
