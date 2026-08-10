import type { HttpClient } from '../client/http-client.js';
import type {
  DriverActivationEligibilityDto,
  DriverKycDto,
  DriverPerformanceStatsDto,
  DriverProfileDto,
  RatingSummaryDto,
  SubmitDriverKycRequest,
  UpdateDriverProfileRequest,
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

  /** Driver Slice 2 item 9 — self-service edit of the founder-scoped
   * driver-editable profile fields. */
  public updateOwnProfile(body: UpdateDriverProfileRequest): Promise<DriverProfileDto> {
    return this.http.request<DriverProfileDto>('/driver/profile', {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  /** Driver Slice 2 item 9 — read-only performance/ratings summary. */
  public getPerformanceStats(): Promise<DriverPerformanceStatsDto> {
    return this.http.request<DriverPerformanceStatsDto>('/driver/profile/performance', {
      method: 'GET',
      auth: true,
    });
  }

  /** DPX-REVIEWS-001 — a driver's public aggregate star rating (no auth). */
  public getPublicRating(driverId: string): Promise<RatingSummaryDto> {
    return this.http.request<RatingSummaryDto>(`/drivers/${encodeURIComponent(driverId)}/rating`, {
      method: 'GET',
      auth: false,
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
