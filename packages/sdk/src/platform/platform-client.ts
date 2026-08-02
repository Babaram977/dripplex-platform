import type { HttpClient } from '../client/http-client.js';
import type {
  AddWishlistItemRequest,
  AdminWalletMutationRequest,
  AnalyticsDailyMetricDto,
  AnalyticsQuery,
  CmsContentDto,
  CmsContentListQuery,
  CreateCmsContentRequest,
  CreateFraudListEntryRequest,
  CreateReviewRequest,
  CreateWishlistRequest,
  DeviceTokenDto,
  FraudListEntryDto,
  FraudListEntryQuery,
  FraudQueueQuery,
  FraudSignalDto,
  FraudThresholdDto,
  LoyaltyAccountDto,
  MoveWishlistToCartRequest,
  MoveWishlistToCartResultDto,
  NotificationListDto,
  NotificationListQuery,
  NotificationDto,
  NotificationPreferenceDto,
  PaginatedResult,
  PopularSearchDto,
  PromotionDto,
  PromotionEvaluationDto,
  PromotionListQuery,
  PromotionRedemptionDto,
  RecentSearchDto,
  RedeemPromotionRequest,
  RedeemLoyaltyPointsRequest,
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
  UpdateCmsContentRequest,
  UpdateFraudListEntryRequest,
  UpdateNotificationPreferencesRequest,
  UpdateWishlistItemRequest,
  UpdateWishlistRequest,
  UpsertFraudThresholdRequest,
  ValidatePromotionRequest,
  WalletHistoryQuery,
  WalletReconciliationDto,
  WalletReconciliationQuery,
  WalletDto,
  WalletLedgerEntryDto,
  WalletTransferDto,
  WalletTransferRequest,
  WishlistDto,
  WishlistItemDto,
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
  public constructor(private readonly http: HttpClient) {}

  public list(query: NotificationListQuery = {}): Promise<NotificationListDto> {
    return this.http.request<NotificationListDto>(
      `/customer/notifications${toQuery({
        status: query.status,
        channel: query.channel,
        type: query.type,
        unreadOnly: query.unreadOnly,
        page: query.page,
        limit: query.limit,
      })}`,
    );
  }

  public markRead(id: string): Promise<NotificationDto> {
    return this.http.request<NotificationDto>(`/customer/notifications/${enc(id)}/read`, {
      method: 'PATCH',
    });
  }

  public markAllRead(): Promise<{ updated: number }> {
    return this.http.request<{ updated: number }>('/customer/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  public delete(id: string): Promise<undefined> {
    return this.http.request<undefined>(`/customer/notifications/${enc(id)}`, {
      method: 'DELETE',
    });
  }

  public preferences(): Promise<NotificationPreferenceDto[]> {
    return this.http.request<NotificationPreferenceDto[]>('/customer/notifications/preferences');
  }

  public updatePreferences(
    body: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferenceDto[]> {
    return this.http.request<NotificationPreferenceDto[]>('/customer/notifications/preferences', {
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

  public active(query: Pick<PromotionListQuery, 'merchantId'> = {}): Promise<PromotionDto[]> {
    return this.http.request<PromotionDto[]>(
      `/customer/promotions/active${toQuery({ merchantId: query.merchantId })}`,
    );
  }

  public list(query: Pick<PromotionListQuery, 'merchantId'> = {}): Promise<PromotionDto[]> {
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

export class LoyaltyClient {
  public constructor(private readonly http: HttpClient) {}

  public account(): Promise<LoyaltyAccountDto> {
    return this.http.request<LoyaltyAccountDto>('/customer/loyalty');
  }

  public redeem(body: RedeemLoyaltyPointsRequest): Promise<LoyaltyAccountDto> {
    return this.http.request<LoyaltyAccountDto>('/customer/loyalty/redeem', {
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
      })}`,
    );
  }

  public transfer(body: WalletTransferRequest): Promise<WalletTransferDto> {
    return this.http.request<WalletTransferDto>('/customer/wallet/transfer', {
      method: 'POST',
      body,
    });
  }

  public merchantWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/merchant/wallet');
  }

  public riderWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/rider/wallet');
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
