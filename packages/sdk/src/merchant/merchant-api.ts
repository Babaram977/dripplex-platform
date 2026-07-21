import type { HttpClient } from '../client/http-client.js';
import type {
  BankAccountDto,
  BusinessDto,
  CreateBankAccountRequest,
  CreateBusinessRequest,
  KycStatusResponse,
  ListMerchantsQuery,
  MerchantApprovalDto,
  MerchantDetailResponse,
  MerchantKycDto,
  PaginatedMerchantsResult,
  SubmitKycRequest,
  UpdateBusinessRequest,
} from '@dripplex/types';

function toQuery(params?: ListMerchantsQuery): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export class MerchantApi {
  public constructor(private readonly http: HttpClient) {}

  public createBusiness(body: CreateBusinessRequest): Promise<BusinessDto> {
    return this.http.request<BusinessDto>('/merchant/business', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public getBusiness(): Promise<BusinessDto> {
    return this.http.request<BusinessDto>('/merchant/business', {
      method: 'GET',
      auth: true,
    });
  }

  public updateBusiness(body: UpdateBusinessRequest): Promise<BusinessDto> {
    return this.http.request<BusinessDto>('/merchant/business', {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public submitKyc(body: SubmitKycRequest): Promise<MerchantKycDto> {
    return this.http.request<MerchantKycDto>('/merchant/kyc', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public getKycStatus(): Promise<KycStatusResponse> {
    return this.http.request<KycStatusResponse>('/merchant/kyc', {
      method: 'GET',
      auth: true,
    });
  }

  public createBankAccount(body: CreateBankAccountRequest): Promise<BankAccountDto> {
    return this.http.request<BankAccountDto>('/merchant/bank-account', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public listBankAccounts(): Promise<BankAccountDto[]> {
    return this.http.request<BankAccountDto[]>('/merchant/bank-account', {
      method: 'GET',
      auth: true,
    });
  }

  public setDefaultBankAccount(id: string): Promise<BankAccountDto> {
    return this.http.request<BankAccountDto>(`/merchant/bank-account/${id}/default`, {
      method: 'PATCH',
      auth: true,
    });
  }
}

export class AdminMerchantsApi {
  public constructor(private readonly http: HttpClient) {}

  public listMerchants(query?: ListMerchantsQuery): Promise<PaginatedMerchantsResult> {
    return this.http.request<PaginatedMerchantsResult>(`/admin/merchants${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getMerchant(id: string): Promise<MerchantDetailResponse> {
    return this.http.request<MerchantDetailResponse>(`/admin/merchant/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public verifyKyc(id: string, remarks?: string): Promise<MerchantKycDto> {
    return this.http.request<MerchantKycDto>(`/admin/merchant/${id}/kyc/verify`, {
      method: 'POST',
      body: { remarks },
      auth: true,
    });
  }

  public rejectKyc(id: string, remarks: string): Promise<MerchantKycDto> {
    return this.http.request<MerchantKycDto>(`/admin/merchant/${id}/kyc/reject`, {
      method: 'POST',
      body: { remarks },
      auth: true,
    });
  }

  public approve(id: string): Promise<MerchantApprovalDto> {
    return this.http.request<MerchantApprovalDto>(`/admin/merchant/${id}/approve`, {
      method: 'POST',
      auth: true,
    });
  }

  public reject(id: string, reason: string): Promise<MerchantApprovalDto> {
    return this.http.request<MerchantApprovalDto>(`/admin/merchant/${id}/reject`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  public suspend(id: string, reason: string): Promise<MerchantApprovalDto> {
    return this.http.request<MerchantApprovalDto>(`/admin/merchant/${id}/suspend`, {
      method: 'POST',
      body: { reason },
      auth: true,
    });
  }

  public reactivate(id: string): Promise<MerchantApprovalDto> {
    return this.http.request<MerchantApprovalDto>(`/admin/merchant/${id}/reactivate`, {
      method: 'POST',
      auth: true,
    });
  }
}
