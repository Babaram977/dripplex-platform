import type { HttpClient } from '../client/http-client.js';
import type {
  AddBankAccountRequest,
  AddWishlistItemRequest,
  AdminReferralRedemptionsQuery,
  AdminWalletMutationRequest,
  AnalyticsDailyMetricDto,
  AnalyticsQuery,
  CampaignAnalyticsQuery,
  ChangeWalletPinRequest,
  CloneCampaignRequest,
  CmsContentDto,
  CmsContentListQuery,
  CreateCmsContentRequest,
  CreateFraudListEntryRequest,
  CreatePromotionRequest,
  CreateReferralCampaignRequest,
  CreateReviewRequest,
  CreateWishlistRequest,
  CreateWithdrawalRequest,
  CustomerBankAccountDto,
  DeviceTokenDto,
  DriverCampaignDashboardDto,
  DriverCampaignLeaderboardEntryDto,
  DriverReferralDto,
  DriverReferralLeaderboardEntryDto,
  DriverReferralRewardDto,
  FraudListEntryDto,
  FundWalletRequest,
  FundWalletResponse,
  FraudListEntryQuery,
  FraudQueueQuery,
  FraudSignalDto,
  FraudThresholdDto,
  ListDriverRewardsQuery,
  ListReferralCampaignsQuery,
  ListReferralFraudChecksQuery,
  LoyaltyAccountOverviewDto,
  LoyaltyLedgerEntryDto,
  MoveWishlistToCartRequest,
  MoveWishlistToCartResultDto,
  NotificationListDto,
  NotificationListQuery,
  NotificationDto,
  NotificationPreferenceDto,
  PaginatedResult,
  PopularSearchDto,
  PromotionAnalyticsDto,
  PromotionDto,
  PromotionEvaluationDto,
  PromotionLeaderboardEntryDto,
  PromotionListQuery,
  PromotionRedemptionDto,
  RecentSearchDto,
  RedeemPromotionRequest,
  RedeemLoyaltyPointsRequest,
  ReferralCampaignDto,
  ReferralDto,
  ReferralFraudCheckDto,
  ReferralFraudCheckStatus,
  ReferralRedemptionDto,
  ReferralStatsDto,
  RegisterDeviceTokenRequest,
  ReplyToReviewRequest,
  ReviewDto,
  ReviewFraudSignalRequest,
  ReviewListQuery,
  ReviewListDto,
  ReviewWithAggregateDto,
  ScheduleCmsContentRequest,
  SearchAutocompleteQuery,
  SearchQuery,
  SearchResultDto,
  SearchSuggestionQuery,
  SetWalletLimitsRequest,
  UpdateCampaignRewardsRequest,
  UpdateCmsContentRequest,
  UpdateFraudListEntryRequest,
  UpdateNotificationPreferencesRequest,
  UpdatePromotionRequest,
  UpdateWishlistItemRequest,
  UpdateWishlistRequest,
  UpsertFraudThresholdRequest,
  ValidatePromotionRequest,
  VerifyWalletFundingRequest,
  WalletHistoryQuery,
  WalletPinStatusDto,
  WalletReconciliationDto,
  WalletReconciliationQuery,
  WalletDto,
  WalletLedgerEntryDto,
  WalletRecipientDto,
  WalletStatementDto,
  WalletTransferDto,
  WalletTransferRequest,
  WishlistDto,
  WishlistItemDto,
  WithdrawalHistoryQuery,
  WithdrawalRequestDto,
} from '@dripplex/types';

function toQuery(params?: Record<string, boolean | number | string | undefined>): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

export class NotificationsClient {
  public constructor(
    private readonly http: HttpClient,
    private readonly basePath = '/customer/notifications',
  ) {}

  public list(query: NotificationListQuery = {}): Promise<NotificationListDto> {
    return this.http.request<NotificationListDto>(
      `${this.basePath}${toQuery({
        status: query.status,
        category: query.category,
        channel: query.channel,
        type: query.type,
        unreadOnly: query.unreadOnly,
        page: query.page,
        limit: query.limit,
      })}`,
    );
  }

  public markRead(id: string): Promise<NotificationDto> {
    return this.http.request<NotificationDto>(`${this.basePath}/${enc(id)}/read`, {
      method: 'PATCH',
    });
  }

  public markAllRead(): Promise<{ updated: number }> {
    return this.http.request<{ updated: number }>(`${this.basePath}/mark-all-read`, {
      method: 'POST',
    });
  }

  public delete(id: string): Promise<undefined> {
    return this.http.request<undefined>(`${this.basePath}/${enc(id)}`, {
      method: 'DELETE',
    });
  }

  public preferences(): Promise<NotificationPreferenceDto[]> {
    return this.http.request<NotificationPreferenceDto[]>(`${this.basePath}/preferences`);
  }

  public updatePreferences(
    body: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferenceDto[]> {
    return this.http.request<NotificationPreferenceDto[]>(`${this.basePath}/preferences`, {
      method: 'PUT',
      body,
    });
  }
}

export class DevicesClient {
  public constructor(private readonly http: HttpClient) {}

  public register(body: RegisterDeviceTokenRequest): Promise<DeviceTokenDto> {
    return this.http.request<DeviceTokenDto>('/customer/devices', {
      method: 'POST',
      body,
    });
  }

  public list(): Promise<DeviceTokenDto[]> {
    return this.http.request<DeviceTokenDto[]>('/customer/devices');
  }

  public deactivate(id: string): Promise<undefined> {
    return this.http.request<undefined>(`/customer/devices/${enc(id)}`, {
      method: 'DELETE',
    });
  }
}

export class SearchClient {
  public constructor(private readonly http: HttpClient) {}

  public search(query: SearchQuery = {}): Promise<SearchResultDto> {
    return this.http.request<SearchResultDto>(
      `/search${toQuery({
        q: query.q,
        type: query.type,
        page: query.page,
        limit: query.limit,
        sort: query.sort,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        merchantId: query.merchantId,
        categoryId: query.categoryId,
        available: query.available,
      })}`,
    );
  }

  public autocomplete(query: SearchAutocompleteQuery): Promise<string[]> {
    return this.http.request<string[]>(
      `/search/autocomplete${toQuery({
        q: query.q,
        type: query.type,
        limit: query.limit,
      })}`,
    );
  }

  public suggestions(query: SearchSuggestionQuery = {}): Promise<string[]> {
    return this.http.request<string[]>(
      `/search/suggestions${toQuery({ q: query.q, limit: query.limit })}`,
    );
  }

  public popular(query: Pick<SearchSuggestionQuery, 'limit'> = {}): Promise<PopularSearchDto[]> {
    return this.http.request<PopularSearchDto[]>(
      `/search/popular${toQuery({ limit: query.limit })}`,
    );
  }

  public recent(query: Pick<SearchSuggestionQuery, 'limit'> = {}): Promise<RecentSearchDto[]> {
    return this.http.request<RecentSearchDto[]>(
      `/customer/search/recent${toQuery({ limit: query.limit })}`,
    );
  }
}

export class ReviewsClient {
  public constructor(private readonly http: HttpClient) {}

  public list(query: ReviewListQuery = {}): Promise<ReviewWithAggregateDto> {
    return this.http.request<ReviewWithAggregateDto>(
      `/reviews${toQuery({
        targetType: query.targetType,
        targetId: query.targetId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
      { auth: false },
    );
  }

  public listForTarget(
    targetType: NonNullable<ReviewListQuery['targetType']>,
    targetId: string,
    query: Omit<ReviewListQuery, 'targetId' | 'targetType'> = {},
  ): Promise<ReviewWithAggregateDto> {
    return this.list({ ...query, targetType, targetId });
  }

  public create(body: CreateReviewRequest): Promise<ReviewDto> {
    return this.http.request<ReviewDto>('/customer/reviews', { method: 'POST', body });
  }

  public listMine(query: ReviewListQuery = {}): Promise<ReviewListDto> {
    return this.http.request<ReviewListDto>(
      `/customer/reviews${toQuery({
        targetType: query.targetType,
        targetId: query.targetId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  }

  public reply(id: string, body: ReplyToReviewRequest): Promise<ReviewDto> {
    return this.http.request<ReviewDto>(`/merchant/reviews/${enc(id)}/reply`, {
      method: 'POST',
      body,
    });
  }
}

export class WishlistClient {
  public constructor(private readonly http: HttpClient) {}

  public list(): Promise<WishlistDto[]> {
    return this.http.request<WishlistDto[]>('/customer/wishlists');
  }

  public get(id: string): Promise<WishlistDto> {
    return this.http.request<WishlistDto>(`/customer/wishlists/${enc(id)}`);
  }

  public create(body: CreateWishlistRequest): Promise<WishlistDto> {
    return this.http.request<WishlistDto>('/customer/wishlists', { method: 'POST', body });
  }

  public update(id: string, body: UpdateWishlistRequest): Promise<WishlistDto> {
    return this.http.request<WishlistDto>(`/customer/wishlists/${enc(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  public delete(id: string): Promise<WishlistDto> {
    return this.http.request<WishlistDto>(`/customer/wishlists/${enc(id)}`, {
      method: 'DELETE',
    });
  }

  public addItem(wishlistId: string, body: AddWishlistItemRequest): Promise<WishlistItemDto> {
    return this.http.request<WishlistItemDto>(`/customer/wishlists/${enc(wishlistId)}/items`, {
      method: 'POST',
      body,
    });
  }

  public updateItem(
    wishlistId: string,
    itemId: string,
    body: UpdateWishlistItemRequest,
  ): Promise<WishlistItemDto> {
    return this.http.request<WishlistItemDto>(
      `/customer/wishlists/${enc(wishlistId)}/items/${enc(itemId)}`,
      {
        method: 'PATCH',
        body,
      },
    );
  }

  public removeItem(
    wishlistId: string,
    itemId: string,
  ): Promise<{ removed: true; itemId: string }> {
    return this.http.request<{ removed: true; itemId: string }>(
      `/customer/wishlists/${enc(wishlistId)}/items/${enc(itemId)}`,
      { method: 'DELETE' },
    );
  }

  public share(id: string): Promise<WishlistDto> {
    return this.http.request<WishlistDto>(`/customer/wishlists/${enc(id)}/share`, {
      method: 'POST',
    });
  }

  public moveToCart(
    id: string,
    body: MoveWishlistToCartRequest,
  ): Promise<MoveWishlistToCartResultDto> {
    return this.http.request<MoveWishlistToCartResultDto>(
      `/customer/wishlists/${enc(id)}/move-to-cart`,
      {
        method: 'POST',
        body,
      },
    );
  }
}

export class PromotionsClient {
  public constructor(private readonly http: HttpClient) {}

  public active(
    query: Pick<PromotionListQuery, 'merchantId' | 'domain'> = {},
  ): Promise<PromotionDto[]> {
    return this.http.request<PromotionDto[]>(
      `/customer/promotions/active${toQuery({ merchantId: query.merchantId, domain: query.domain })}`,
    );
  }

  public list(
    query: Pick<PromotionListQuery, 'merchantId' | 'domain'> = {},
  ): Promise<PromotionDto[]> {
    return this.active(query);
  }

  public validate(body: ValidatePromotionRequest): Promise<PromotionEvaluationDto> {
    return this.http.request<PromotionEvaluationDto>('/customer/promotions/validate', {
      method: 'POST',
      body,
    });
  }

  public redeem(body: RedeemPromotionRequest): Promise<PromotionRedemptionDto> {
    return this.http.request<PromotionRedemptionDto>('/customer/promotions/redeem', {
      method: 'POST',
      body,
    });
  }
}

export class AdminPromotionsClient {
  public constructor(private readonly http: HttpClient) {}

  public create(body: CreatePromotionRequest): Promise<PromotionDto> {
    return this.http.request<PromotionDto>('/admin/promotions', { method: 'POST', body });
  }

  public list(query: PromotionListQuery = {}): Promise<PromotionDto[]> {
    return this.http.request<PromotionDto[]>(
      `/admin/promotions${toQuery({
        merchantId: query.merchantId,
        status: query.status,
        domain: query.domain,
      })}`,
    );
  }

  public get(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}`);
  }

  public update(id: string, body: UpdatePromotionRequest): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  public delete(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}`, { method: 'DELETE' });
  }

  public pause(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}/pause`, {
      method: 'POST',
    });
  }

  public resume(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}/resume`, {
      method: 'POST',
    });
  }

  public archive(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}/archive`, {
      method: 'POST',
    });
  }

  public forceExpire(id: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}/force-expire`, {
      method: 'POST',
    });
  }

  public clone(id: string, body: CloneCampaignRequest = {}): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/admin/promotions/${enc(id)}/clone`, {
      method: 'POST',
      body,
    });
  }

  public analytics(id: string, query: CampaignAnalyticsQuery = {}): Promise<PromotionAnalyticsDto> {
    return this.http.request<PromotionAnalyticsDto>(
      `/admin/promotions/${enc(id)}/analytics${toQuery({ from: query.from, to: query.to })}`,
    );
  }

  public topCampaigns(query: CampaignAnalyticsQuery = {}): Promise<PromotionLeaderboardEntryDto[]> {
    return this.http.request<PromotionLeaderboardEntryDto[]>(
      `/admin/promotions/analytics/top${toQuery({ from: query.from, to: query.to })}`,
    );
  }

  public exportUrl(id: string): string {
    return `/admin/promotions/${enc(id)}/export`;
  }
}

export class ReferralsClient {
  public constructor(private readonly http: HttpClient) {}

  public me(): Promise<ReferralDto> {
    return this.http.request<ReferralDto>('/customer/referrals/me');
  }

  public stats(): Promise<ReferralStatsDto> {
    return this.http.request<ReferralStatsDto>('/customer/referrals/stats');
  }
}

export class AdminReferralsClient {
  public constructor(private readonly http: HttpClient) {}

  public redemptions(
    query: AdminReferralRedemptionsQuery = {},
  ): Promise<PaginatedResult<ReferralRedemptionDto>> {
    return this.http.request<PaginatedResult<ReferralRedemptionDto>>(
      `/admin/referrals/redemptions${toQuery({
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  }
}

export class DriverCampaignClient {
  public constructor(private readonly http: HttpClient) {}

  public getMyCode(): Promise<{ campaign: ReferralCampaignDto; referral: DriverReferralDto }> {
    return this.http.request<{ campaign: ReferralCampaignDto; referral: DriverReferralDto }>(
      '/driver/referral-campaign/code',
    );
  }

  public async recordInvite(): Promise<void> {
    await this.http.request('/driver/referral-campaign/invite', { method: 'POST' });
  }

  public getDashboard(): Promise<DriverCampaignDashboardDto> {
    return this.http.request<DriverCampaignDashboardDto>('/driver/referral-campaign/dashboard');
  }

  public getLeaderboard(): Promise<DriverCampaignLeaderboardEntryDto[]> {
    return this.http.request<DriverCampaignLeaderboardEntryDto[]>(
      '/driver/referral-campaign/leaderboard',
    );
  }
}

export class AdminDriverCampaignClient {
  public constructor(private readonly http: HttpClient) {}

  public createCampaign(body: CreateReferralCampaignRequest): Promise<ReferralCampaignDto> {
    return this.http.request<ReferralCampaignDto>('/admin/referral-campaigns', {
      method: 'POST',
      body,
    });
  }

  public listCampaigns(query: ListReferralCampaignsQuery = {}): Promise<ReferralCampaignDto[]> {
    return this.http.request<ReferralCampaignDto[]>(
      `/admin/referral-campaigns${toQuery({ status: query.status })}`,
    );
  }

  public updateRewards(
    campaignId: string,
    body: UpdateCampaignRewardsRequest,
  ): Promise<ReferralCampaignDto> {
    return this.http.request<ReferralCampaignDto>(
      `/admin/referral-campaigns/${enc(campaignId)}/rewards`,
      { method: 'PATCH', body },
    );
  }

  public pauseCampaign(campaignId: string): Promise<ReferralCampaignDto> {
    return this.http.request<ReferralCampaignDto>(
      `/admin/referral-campaigns/${enc(campaignId)}/pause`,
      { method: 'POST' },
    );
  }

  public resumeCampaign(campaignId: string): Promise<ReferralCampaignDto> {
    return this.http.request<ReferralCampaignDto>(
      `/admin/referral-campaigns/${enc(campaignId)}/resume`,
      { method: 'POST' },
    );
  }

  public leaderboard(campaignId: string): Promise<DriverReferralLeaderboardEntryDto[]> {
    return this.http.request<DriverReferralLeaderboardEntryDto[]>(
      `/admin/referral-campaigns/${enc(campaignId)}/leaderboard`,
    );
  }

  public exportUrl(campaignId: string): string {
    return `/admin/referral-campaigns/${enc(campaignId)}/export`;
  }

  public listRewards(query: ListDriverRewardsQuery = {}): Promise<DriverReferralRewardDto[]> {
    return this.http.request<DriverReferralRewardDto[]>(
      `/admin/referral-campaigns/rewards${toQuery({
        campaignId: query.campaignId,
        status: query.status,
      })}`,
    );
  }

  public approveReward(rewardId: string): Promise<DriverReferralRewardDto> {
    return this.http.request<DriverReferralRewardDto>(
      `/admin/referral-campaigns/rewards/${enc(rewardId)}/approve`,
      { method: 'POST' },
    );
  }

  public rejectReward(rewardId: string, reason: string): Promise<DriverReferralRewardDto> {
    return this.http.request<DriverReferralRewardDto>(
      `/admin/referral-campaigns/rewards/${enc(rewardId)}/reject`,
      { method: 'POST', body: { reason } },
    );
  }

  public payReward(rewardId: string): Promise<DriverReferralRewardDto> {
    return this.http.request<DriverReferralRewardDto>(
      `/admin/referral-campaigns/rewards/${enc(rewardId)}/pay`,
      { method: 'POST' },
    );
  }

  public listFraudChecks(
    query: ListReferralFraudChecksQuery = {},
  ): Promise<ReferralFraudCheckDto[]> {
    return this.http.request<ReferralFraudCheckDto[]>(
      `/admin/referral-campaigns/fraud-checks${toQuery({ status: query.status })}`,
    );
  }

  public reviewFraudCheck(
    fraudCheckId: string,
    status: ReferralFraudCheckStatus,
  ): Promise<ReferralFraudCheckDto> {
    return this.http.request<ReferralFraudCheckDto>(
      `/admin/referral-campaigns/fraud-checks/${enc(fraudCheckId)}/review`,
      { method: 'POST', body: { status } },
    );
  }
}

export class LoyaltyClient {
  public constructor(private readonly http: HttpClient) {}

  public account(): Promise<LoyaltyAccountOverviewDto> {
    return this.http.request<LoyaltyAccountOverviewDto>('/customer/loyalty');
  }

  public history(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<LoyaltyLedgerEntryDto>> {
    return this.http.request<PaginatedResult<LoyaltyLedgerEntryDto>>(
      `/customer/loyalty/history${toQuery({ page: query.page, pageSize: query.pageSize })}`,
    );
  }

  public redeem(body: RedeemLoyaltyPointsRequest): Promise<LoyaltyAccountOverviewDto> {
    return this.http.request<LoyaltyAccountOverviewDto>('/customer/loyalty/redeem', {
      method: 'POST',
      body,
    });
  }
}

export class WalletClient {
  public constructor(private readonly http: HttpClient) {}

  public customerWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/customer/wallet');
  }

  public customerTransactions(
    query: WalletHistoryQuery = {},
  ): Promise<PaginatedResult<WalletLedgerEntryDto>> {
    return this.http.request<PaginatedResult<WalletLedgerEntryDto>>(
      `/customer/wallet/transactions${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        type: query.type,
      })}`,
    );
  }

  public lookupTransferRecipient(phone: string): Promise<WalletRecipientDto[]> {
    return this.http.request<WalletRecipientDto[]>(
      `/customer/wallet/transfer/recipients${toQuery({ phone })}`,
    );
  }

  public recentTransferRecipients(): Promise<WalletRecipientDto[]> {
    return this.http.request<WalletRecipientDto[]>('/customer/wallet/transfer/recipients/recent');
  }

  public transfer(body: WalletTransferRequest): Promise<WalletTransferDto> {
    return this.http.request<WalletTransferDto>('/customer/wallet/transfer', {
      method: 'POST',
      body,
    });
  }

  public fund(body: FundWalletRequest): Promise<FundWalletResponse> {
    return this.http.request<FundWalletResponse>('/customer/wallet/fund', {
      method: 'POST',
      body,
    });
  }

  public verifyFunding(body: VerifyWalletFundingRequest = {}): Promise<WalletDto> {
    return this.http.request<WalletDto>('/customer/wallet/fund/verify', {
      method: 'POST',
      body,
    });
  }

  public listBankAccounts(): Promise<CustomerBankAccountDto[]> {
    return this.http.request<CustomerBankAccountDto[]>('/customer/wallet/bank-accounts');
  }

  public addBankAccount(body: AddBankAccountRequest): Promise<CustomerBankAccountDto> {
    return this.http.request<CustomerBankAccountDto>('/customer/wallet/bank-accounts', {
      method: 'POST',
      body,
    });
  }

  public setDefaultBankAccount(id: string): Promise<CustomerBankAccountDto> {
    return this.http.request<CustomerBankAccountDto>(
      `/customer/wallet/bank-accounts/${enc(id)}/default`,
      { method: 'PATCH' },
    );
  }

  public removeBankAccount(id: string): Promise<{ removed: boolean }> {
    return this.http.request<{ removed: boolean }>(`/customer/wallet/bank-accounts/${enc(id)}`, {
      method: 'DELETE',
    });
  }

  public pinStatus(): Promise<WalletPinStatusDto> {
    return this.http.request<WalletPinStatusDto>('/customer/wallet/pin/status');
  }

  public setPin(pin: string): Promise<WalletPinStatusDto> {
    return this.http.request<WalletPinStatusDto>('/customer/wallet/pin', {
      method: 'POST',
      body: { pin },
    });
  }

  public verifyPin(pin: string): Promise<{ valid: boolean }> {
    return this.http.request<{ valid: boolean }>('/customer/wallet/pin/verify', {
      method: 'POST',
      body: { pin },
    });
  }

  public changePin(body: ChangeWalletPinRequest): Promise<WalletPinStatusDto> {
    return this.http.request<WalletPinStatusDto>('/customer/wallet/pin', {
      method: 'PUT',
      body,
    });
  }

  public setLimits(body: SetWalletLimitsRequest): Promise<WalletDto> {
    return this.http.request<WalletDto>('/customer/wallet/limits', {
      method: 'PUT',
      body,
    });
  }

  public statement(month: number, year: number): Promise<WalletStatementDto> {
    return this.http.request<WalletStatementDto>(
      `/customer/wallet/statement${toQuery({ month, year })}`,
    );
  }

  public async exportStatement(month: number, year: number): Promise<Blob> {
    return await this.http.requestBlob(
      `/customer/wallet/statement/export${toQuery({ month, year })}`,
    );
  }

  public createWithdrawal(body: CreateWithdrawalRequest): Promise<WithdrawalRequestDto> {
    return this.http.request<WithdrawalRequestDto>('/customer/wallet/withdrawals', {
      method: 'POST',
      body,
    });
  }

  public listWithdrawals(
    query: WithdrawalHistoryQuery = {},
  ): Promise<PaginatedResult<WithdrawalRequestDto>> {
    return this.http.request<PaginatedResult<WithdrawalRequestDto>>(
      `/customer/wallet/withdrawals${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      })}`,
    );
  }

  public getWithdrawal(id: string): Promise<WithdrawalRequestDto> {
    return this.http.request<WithdrawalRequestDto>(`/customer/wallet/withdrawals/${enc(id)}`);
  }

  public merchantWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/merchant/wallet');
  }

  public riderWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/rider/wallet');
  }

  public driverWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/driver/wallet');
  }

  public driverTransactions(
    query: WalletHistoryQuery = {},
  ): Promise<PaginatedResult<WalletLedgerEntryDto>> {
    return this.http.request<PaginatedResult<WalletLedgerEntryDto>>(
      `/driver/wallet/transactions${toQuery({
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  }
}

export class AdminWalletClient {
  public constructor(private readonly http: HttpClient) {}

  public reconciliation(query: WalletReconciliationQuery): Promise<WalletReconciliationDto> {
    return this.http.request<WalletReconciliationDto>(
      `/admin/wallets/reconciliation${toQuery({
        ownerType: query.ownerType,
        ownerId: query.ownerId,
        currency: query.currency,
      })}`,
    );
  }

  public credit(
    ownerType: WalletReconciliationQuery['ownerType'],
    ownerId: string,
    body: AdminWalletMutationRequest,
  ): Promise<WalletDto> {
    return this.http.request<WalletDto>(`/admin/wallets/${enc(ownerType)}/${enc(ownerId)}/credit`, {
      method: 'POST',
      body,
    });
  }

  public debit(
    ownerType: WalletReconciliationQuery['ownerType'],
    ownerId: string,
    body: AdminWalletMutationRequest,
  ): Promise<WalletDto> {
    return this.http.request<WalletDto>(`/admin/wallets/${enc(ownerType)}/${enc(ownerId)}/debit`, {
      method: 'POST',
      body,
    });
  }

  public listWithdrawals(
    query: WithdrawalHistoryQuery = {},
  ): Promise<PaginatedResult<WithdrawalRequestDto>> {
    return this.http.request<PaginatedResult<WithdrawalRequestDto>>(
      `/admin/wallet/withdrawals${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
      })}`,
    );
  }

  public completeWithdrawal(id: string, adminNote?: string): Promise<WithdrawalRequestDto> {
    return this.http.request<WithdrawalRequestDto>(
      `/admin/wallet/withdrawals/${enc(id)}/complete`,
      {
        method: 'POST',
        body: { adminNote },
      },
    );
  }

  public failWithdrawal(id: string, reason: string): Promise<WithdrawalRequestDto> {
    return this.http.request<WithdrawalRequestDto>(`/admin/wallet/withdrawals/${enc(id)}/fail`, {
      method: 'POST',
      body: { reason },
    });
  }
}

export class AnalyticsClient {
  public constructor(private readonly http: HttpClient) {}

  public merchant(query: AnalyticsQuery = {}): Promise<AnalyticsDailyMetricDto[]> {
    return this.http.request<AnalyticsDailyMetricDto[]>(
      `/merchant/analytics${toQuery({
        scopeId: query.scopeId,
        metricKey: query.metricKey,
        from: query.from,
        to: query.to,
      })}`,
    );
  }

  public admin(query: AnalyticsQuery = {}): Promise<AnalyticsDailyMetricDto[]> {
    return this.http.request<AnalyticsDailyMetricDto[]>(
      `/admin/analytics${toQuery({
        scopeType: query.scopeType,
        scopeId: query.scopeId,
        metricKey: query.metricKey,
        from: query.from,
        to: query.to,
      })}`,
    );
  }
}

export class CmsClient {
  public constructor(private readonly http: HttpClient) {}

  public page(slug: string): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/cms/pages/${enc(slug)}`, { auth: false });
  }

  public banners(): Promise<CmsContentDto[]> {
    return this.http.request<CmsContentDto[]>('/cms/banners', { auth: false });
  }
}

export class AdminCmsClient {
  public constructor(private readonly http: HttpClient) {}

  public list(query: CmsContentListQuery = {}): Promise<PaginatedResult<CmsContentDto>> {
    return this.http.request<PaginatedResult<CmsContentDto>>(
      `/admin/cms/contents${toQuery({
        type: query.type,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  }

  public get(id: string): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/admin/cms/contents/${enc(id)}`);
  }

  public create(body: CreateCmsContentRequest): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>('/admin/cms/contents', { method: 'POST', body });
  }

  public update(id: string, body: UpdateCmsContentRequest): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/admin/cms/contents/${enc(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  public publish(id: string): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/admin/cms/contents/${enc(id)}/publish`, {
      method: 'POST',
    });
  }

  public schedule(id: string, body: ScheduleCmsContentRequest): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/admin/cms/contents/${enc(id)}/schedule`, {
      method: 'POST',
      body,
    });
  }
}

export class AdminFraudClient {
  public constructor(private readonly http: HttpClient) {}

  public queue(query: FraudQueueQuery = {}): Promise<PaginatedResult<FraudSignalDto>> {
    return this.http.request<PaginatedResult<FraudSignalDto>>(
      `/admin/fraud/queue${toQuery({
        status: query.status,
        riskLevel: query.riskLevel,
        userId: query.userId,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  }

  public review(id: string, body: ReviewFraudSignalRequest): Promise<FraudSignalDto> {
    return this.http.request<FraudSignalDto>(`/admin/fraud/signals/${enc(id)}/review`, {
      method: 'POST',
      body,
    });
  }

  public clear(id: string): Promise<FraudSignalDto> {
    return this.http.request<FraudSignalDto>(`/admin/fraud/signals/${enc(id)}/clear`, {
      method: 'POST',
    });
  }

  public confirm(id: string): Promise<FraudSignalDto> {
    return this.http.request<FraudSignalDto>(`/admin/fraud/signals/${enc(id)}/confirm`, {
      method: 'POST',
    });
  }

  public thresholds(): Promise<FraudThresholdDto[]> {
    return this.http.request<FraudThresholdDto[]>('/admin/fraud/thresholds');
  }

  public upsertThreshold(
    key: string,
    body: UpsertFraudThresholdRequest,
  ): Promise<FraudThresholdDto> {
    return this.http.request<FraudThresholdDto>(`/admin/fraud/thresholds/${enc(key)}`, {
      method: 'PATCH',
      body,
    });
  }

  public listEntries(query: FraudListEntryQuery = {}): Promise<FraudListEntryDto[]> {
    return this.http.request<FraudListEntryDto[]>(
      `/admin/fraud/list-entries${toQuery({
        listType: query.listType,
        matchType: query.matchType,
        active: query.active,
      })}`,
    );
  }

  public createEntry(body: CreateFraudListEntryRequest): Promise<FraudListEntryDto> {
    return this.http.request<FraudListEntryDto>('/admin/fraud/list-entries', {
      method: 'POST',
      body,
    });
  }

  public updateEntry(id: string, body: UpdateFraudListEntryRequest): Promise<FraudListEntryDto> {
    return this.http.request<FraudListEntryDto>(`/admin/fraud/list-entries/${enc(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  public deleteEntry(id: string): Promise<FraudListEntryDto> {
    return this.http.request<FraudListEntryDto>(`/admin/fraud/list-entries/${enc(id)}`, {
      method: 'DELETE',
    });
  }
}
