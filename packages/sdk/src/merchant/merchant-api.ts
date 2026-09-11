import type { HttpClient } from '../client/http-client.js';
import type {
  AddProductImageRequest,
  BankAccountDto,
  BrowseMerchantsQuery,
  BusinessDto,
  BankOptionDto,
  CreateBankAccountRequest,
  CreateWithdrawalRequest,
  PayoutResultDto,
  ResolvedBankAccountDto,
  WithdrawalRequestDto,
  CreateBusinessRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  CursorPaginatedResult,
  KycStatusResponse,
  ListMerchantProductsQuery,
  ListMerchantsQuery,
  MerchantApprovalDto,
  MerchantCommissionTermsDto,
  MerchantDetailDto,
  MerchantDetailResponse,
  MerchantKycDto,
  MerchantSummaryDto,
  OrderSettlementDto,
  PaginatedMerchantsResult,
  PaginatedResult,
  PauseStoreRequest,
  ProductDto,
  ReorderProductImagesRequest,
  SmartSearchResult,
  SubmitKycRequest,
  UpdateBusinessRequest,
  UpdateProductInventoryRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  WalletDto,
  WalletHistoryQuery,
  WalletLedgerEntryDto,
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

  /** The banks the payment provider accepts, for the picker. A merchant typing
   * a bank name by hand is how a settlement destination ends up unlinkable. */
  public listBanks(): Promise<BankOptionDto[]> {
    return this.http.request<BankOptionDto[]>('/merchant/bank-account/banks', {
      method: 'GET',
      auth: true,
    });
  }

  /** Name enquiry for the form. The settlement account name is the bank's
   * answer, so a merchant confirms a real account holder instead of typing one. */
  public resolveBankAccount(
    bankCode: string,
    accountNumber: string,
  ): Promise<ResolvedBankAccountDto> {
    const query = new URLSearchParams({ bankCode, accountNumber }).toString();
    return this.http.request<ResolvedBankAccountDto>(`/merchant/bank-account/resolve?${query}`, {
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

  /**
   * The commission rate in force for this merchant.
   *
   * Read from the platform rather than printed as static text: Ops can change
   * the standing rate without a redeploy, and a commission campaign can target
   * named merchants, so a hardcoded percentage is a claim the platform stopped
   * guaranteeing.
   */
  public getCommissionTerms(): Promise<MerchantCommissionTermsDto> {
    return this.http.request<MerchantCommissionTermsDto>('/merchant/settlements/commission', {
      method: 'GET',
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

  /**
   * Storefront-level availability — matches `MerchantController`'s
   * `POST /merchant/business/pause|resume` 1:1. Real backend capability
   * with zero prior SDK coverage; see DPX-MERCHANT-001-REALITY-AUDIT.md.
   */
  public pauseStore(body: PauseStoreRequest = {}): Promise<BusinessDto> {
    return this.http.request<BusinessDto>('/merchant/business/pause', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public resumeStore(): Promise<BusinessDto> {
    return this.http.request<BusinessDto>('/merchant/business/resume', {
      method: 'POST',
      auth: true,
    });
  }

  /**
   * DPX-MERCHANT-007 — Wallet & Bank. Matches
   * `MerchantWalletController`'s `GET /merchant/wallet` 1:1.
   */
  public getWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/merchant/wallet', {
      method: 'GET',
      auth: true,
    });
  }

  /**
   * DPX-MERCHANT-007 — full wallet ledger history (every credit/debit,
   * not just settlements). Matches `MerchantWalletController`'s
   * `GET /merchant/wallet/transactions` 1:1.
   */
  public getWalletTransactions(
    query: WalletHistoryQuery = {},
  ): Promise<PaginatedResult<WalletLedgerEntryDto>> {
    return this.http.request<PaginatedResult<WalletLedgerEntryDto>>(
      `/merchant/wallet/transactions${toQueryString(query)}`,
      { method: 'GET', auth: true },
    );
  }

  /**
   * A merchant asking to be paid out of their own wallet balance.
   *
   * Automatic settlement is unchanged and stays the main route: an online order
   * completing transfers the net amount without anybody asking. This is the
   * manual request alongside it, into the same Operations queue and the same
   * approval every other persona goes through. The destination is the
   * merchant's existing verified settlement account.
   */
  public requestPayout(body: CreateWithdrawalRequest): Promise<PayoutResultDto> {
    return this.http.request<PayoutResultDto>('/merchant/wallet/payouts', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public listPayouts(
    query: WalletHistoryQuery = {},
  ): Promise<PaginatedResult<WithdrawalRequestDto>> {
    return this.http.request<PaginatedResult<WithdrawalRequestDto>>(
      `/merchant/wallet/payouts${toQueryString(query)}`,
      { method: 'GET', auth: true },
    );
  }

  /** Required before money can leave the wallet, exactly as for a driver. */
  public setWalletPin(pin: string): Promise<{ set: true }> {
    return this.http.request<{ set: true }>('/merchant/wallet/pin', {
      method: 'POST',
      body: { pin },
      auth: true,
    });
  }

  public hasWalletPin(): Promise<{ set: boolean }> {
    return this.http.request<{ set: boolean }>('/merchant/wallet/pin', {
      method: 'GET',
      auth: true,
    });
  }

  /**
   * DPX-MERCHANT-007 — per-order settlement transparency (gross,
   * commission rate/amount, net, status, order reference, date) so the
   * merchant can always answer "why did I receive ₦9,000 instead of
   * ₦10,000". Matches `MerchantSettlementsController`'s
   * `GET /merchant/settlements` 1:1.
   */
  public listSettlements(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<OrderSettlementDto>> {
    return this.http.request<PaginatedResult<OrderSettlementDto>>(
      `/merchant/settlements${toQueryString(query)}`,
      { method: 'GET', auth: true },
    );
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

export interface MerchantSmartSearchQuery {
  query: string;
  lat?: number;
  lng?: number;
  cursor?: string;
  limit?: number;
}

/** Customer-facing merchant browsing / Mini Store (R1.5) — public, no auth required. */
export class CustomerMerchantsApi {
  public constructor(private readonly http: HttpClient) {}

  public browse(query?: BrowseMerchantsQuery): Promise<CursorPaginatedResult<MerchantSummaryDto>> {
    return this.http.request<CursorPaginatedResult<MerchantSummaryDto>>(
      `/merchants${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public smartSearch(
    query: MerchantSmartSearchQuery,
  ): Promise<SmartSearchResult<MerchantSummaryDto>> {
    return this.http.request<SmartSearchResult<MerchantSummaryDto>>(
      `/merchants/smart-search${toQueryString(query)}`,
      { method: 'GET', auth: false },
    );
  }

  public get(id: string, location?: { lat: number; lng: number }): Promise<MerchantDetailDto> {
    return this.http.request<MerchantDetailDto>(`/merchants/${id}${toQueryString(location)}`, {
      method: 'GET',
      auth: false,
    });
  }
}
