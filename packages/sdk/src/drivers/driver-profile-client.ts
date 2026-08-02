import type { HttpClient } from '../client/http-client.js';
import type { DriverKycDto, DriverProfileDto, SubmitDriverKycRequest } from '@dripplex/types';

/**
 * Driver-side profile/KYC HTTP surface — mirrors DriverController exactly
 * (apps/backend/src/drivers/controllers/driver.controller.ts).
 */
export class DriverProfileClient {
  public constructor(private readonly http: HttpClient) {}

  public getOwnProfile(): Promise<DriverProfileDto> {
    return this.http.request<DriverProfileDto>('/driver/profile', {
      method: 'GET',
      auth: true,
    });
  }

  public submitKyc(body: SubmitDriverKycRequest): Promise<DriverKycDto> {
    return this.http.request<DriverKycDto>('/driver/kyc', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
