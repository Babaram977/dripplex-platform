import type { HttpClient } from '../client/http-client.js';
import type {
  AddProductImageRequest,
  BankAccountDto,
  BusinessDto,
  CreateBankAccountRequest,
  CreateBusinessRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  KycStatusResponse,
  ListMerchantProductsQuery,
  ListMerchantsQuery,
  MerchantApprovalDto,
  MerchantDetailResponse,
  MerchantKycDto,
  PaginatedMerchantsResult,
  PaginatedResult,
  ProductDto,
  ReorderProductImagesRequest,
  SubmitKycRequest,
  UpdateBusinessRequest,
  UpdateProductInventoryRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
} from '@dripplex/types';

function toQueryString(params?: object): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (
      (typeof value === 'string' && value !== '') ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function toQuery(params?: ListMerchantsQuery): string {
  return toQueryString(params);
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

export class MerchantProductsApi {
  public constructor(private readonly http: HttpClient) {}

  public list(query?: ListMerchantProductsQuery): Promise<PaginatedResult<ProductDto>> {
    return this.http.request<PaginatedResult<ProductDto>>(
      `/merchant/products${toQueryString(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public get(id: string): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public create(body: CreateProductRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>('/merchant/products', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public update(id: string, body: UpdateProductRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public remove(id: string): Promise<{ deleted: true }> {
    return this.http.request<{ deleted: true }>(`/merchant/products/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public publish(id: string): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/publish`, {
      method: 'POST',
      auth: true,
    });
  }

  public unpublish(id: string): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/unpublish`, {
      method: 'POST',
      auth: true,
    });
  }

  public addImage(id: string, body: AddProductImageRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/images`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public removeImage(id: string, imageId: string): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/images/${imageId}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public reorderImages(id: string, body: ReorderProductImagesRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/images/reorder`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public createVariant(id: string, body: CreateProductVariantRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/variants`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public updateVariant(
    id: string,
    variantId: string,
    body: UpdateProductVariantRequest,
  ): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/variants/${variantId}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public removeVariant(id: string, variantId: string): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/variants/${variantId}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public updateInventory(id: string, body: UpdateProductInventoryRequest): Promise<ProductDto> {
    return this.http.request<ProductDto>(`/merchant/products/${id}/inventory`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
