import type { HttpClient } from '../client/http-client.js';
import type {
  DriverIdentityVerificationDto,
  IdentityVerificationStatusDto,
  SubmitIdentityVerificationRequest,
} from '@dripplex/types';

function toQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

/**
 * Driver-001 — mirrors DriverIdentityVerificationController exactly
 * (apps/backend/src/drivers/controllers/driver-identity-verification.controller.ts).
 */
export class DriverIdentityVerificationClient {
  public constructor(private readonly http: HttpClient) {}

  public getStatus(deviceId?: string): Promise<IdentityVerificationStatusDto> {
    return this.http.request<IdentityVerificationStatusDto>(
      `/driver/identity-verification/status${toQuery({ deviceId })}`,
      { method: 'GET', auth: true },
    );
  }

  public submit(body: SubmitIdentityVerificationRequest): Promise<DriverIdentityVerificationDto> {
    return this.http.request<DriverIdentityVerificationDto>(
      '/driver/identity-verification/submit',
      {
        method: 'POST',
        body,
        auth: true,
      },
    );
  }
}
