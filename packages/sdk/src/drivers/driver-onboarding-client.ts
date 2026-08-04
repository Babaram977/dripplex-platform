import type { HttpClient } from '../client/http-client.js';
import type {
  AcceptDriverAgreementRequest,
  DriverOnboardingDto,
  SubmitEmergencyContactRequest,
} from '@dripplex/types';

/**
 * DPX-DRIVER-002 Phase 1 — structured onboarding submission. Mirrors the
 * onboarding endpoints on DriverController exactly
 * (apps/backend/src/drivers/controllers/driver.controller.ts).
 */
export class DriverOnboardingClient {
  public constructor(private readonly http: HttpClient) {}

  public getOwn(): Promise<DriverOnboardingDto> {
    return this.http.request<DriverOnboardingDto>('/driver/onboarding', {
      method: 'GET',
      auth: true,
    });
  }

  public submitEmergencyContact(body: SubmitEmergencyContactRequest): Promise<DriverOnboardingDto> {
    return this.http.request<DriverOnboardingDto>('/driver/onboarding/emergency-contact', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public acceptAgreement(body: AcceptDriverAgreementRequest): Promise<DriverOnboardingDto> {
    return this.http.request<DriverOnboardingDto>('/driver/onboarding/agreement', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public submit(): Promise<DriverOnboardingDto> {
    return this.http.request<DriverOnboardingDto>('/driver/onboarding/submit', {
      method: 'POST',
      auth: true,
    });
  }
}
