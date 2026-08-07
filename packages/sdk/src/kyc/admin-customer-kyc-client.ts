import type { HttpClient } from '../client/http-client.js';
import type {
  AdminCustomerKycListItemDto,
  CustomerKycStatusDto,
  RejectCustomerKycValues,
  ReviewCustomerKycValues,
} from '@dripplex/types';

/**
 * DPX-PROFILE-KYC-002 -- admin review of customer Level 2 KYC submissions
 * (`admin/customer-kyc`). Mirrors `AdminCustomerKycController` exactly.
 */
export class AdminCustomerKycClient {
  public constructor(private readonly http: HttpClient) {}

  public listPending(): Promise<AdminCustomerKycListItemDto[]> {
    return this.http.request<AdminCustomerKycListItemDto[]>('/admin/customer-kyc/pending', {
      method: 'GET',
      auth: true,
    });
  }

  public getForUser(userId: string): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>(`/admin/customer-kyc/user/${userId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public verify(kycId: string, body: ReviewCustomerKycValues = {}): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>(`/admin/customer-kyc/${kycId}/verify`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public reject(kycId: string, body: RejectCustomerKycValues): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>(`/admin/customer-kyc/${kycId}/reject`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public requestResubmission(
    kycId: string,
    body: RejectCustomerKycValues,
  ): Promise<CustomerKycStatusDto> {
    return this.http.request<CustomerKycStatusDto>(
      `/admin/customer-kyc/${kycId}/request-resubmission`,
      {
        method: 'POST',
        body,
        auth: true,
      },
    );
  }
}
