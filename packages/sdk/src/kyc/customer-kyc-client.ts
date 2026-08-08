import type { HttpClient } from '../client/http-client.js';
import type { CustomerKycStatusDto, SubmitCustomerKycValues } from '@dripplex/types';

/**
 * DPX-PROFILE-KYC-002 -- self-service Level 2 identity verification
 * (`kyc/me`). Mirrors `CustomerKycController` exactly. Levels 0/1 are read
 * off `CustomerKycStatusDto.levelAccess`, not submitted through this client
 * -- they're derived from existing phone/email verification.
 */
export class CustomerKycClient {
  public constructor(private readonly http: HttpClient) {}

  public getStatus(): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>('/kyc/me', {
      method: 'GET',
      auth: true,
    });
  }

  public start(): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>('/kyc/me/start', {
      method: 'POST',
      auth: true,
    });
  }

  public submit(body: SubmitCustomerKycValues): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>('/kyc/me/submit', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
