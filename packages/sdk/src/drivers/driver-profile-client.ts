import type { HttpClient } from '../client/http-client.js';
import type {
  DriverActivationEligibilityDto,
  DriverKycDto,
  DriverProfileDto,
  SubmitDriverKycRequest,
} from '@dripplex/types';

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

  /** DPX-DRIVER-002 Phase 4 — the unified activation gate, driver-facing. */
  public getActivationEligibility(): Promise<DriverActivationEligibilityDto> {
    return this.http.request<DriverActivationEligibilityDto>('/driver/activation-eligibility', {
      method: 'GET',
      auth: true,
    });
  }
}
