import type { HttpClient } from '../client/http-client.js';
import type {
  AddWishlistItemRequest,
  AnalyticsDailyMetricDto,
  AnalyticsQuery,
  CmsContentDto,
  CmsContentListQuery,
  CreateCmsContentRequest,
  CreateFraudListEntryRequest,
  CreateReviewRequest,
  CreateWishlistRequest,
  FraudListEntryDto,
  FraudListEntryQuery,
  FraudQueueQuery,
  FraudSignalDto,
  FraudThresholdDto,
  LoyaltyAccountDto,
  NotificationDto,
  NotificationPreferenceDto,
  PaginatedResult,
  PromotionDto,
  RedeemLoyaltyPointsRequest,
  ReplyToReviewRequest,
  ReviewDto,
  ReviewFraudSignalRequest,
  ScheduleCmsContentRequest,
  SearchQuery,
  SearchResultDto,
  UpdateCmsContentRequest,
  UpdateFraudListEntryRequest,
  UpdateNotificationPreferenceRequest,
  UpsertFraudThresholdRequest,
  WalletDto,
  WalletLedgerEntryDto,
  WalletTransferRequest,
  WishlistDto,
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

  public list(): Promise<PaginatedResult<NotificationDto>> {
    return this.http.request<PaginatedResult<NotificationDto>>('/customer/notifications');
  }

  public markRead(id: string): Promise<NotificationDto> {
    return this.http.request<NotificationDto>(`/customer/notifications/${enc(id)}/read`, {
      method: 'POST',
    });
  }

  public updatePreference(body: UpdateNotificationPreferenceRequest): Promise<NotificationPreferenceDto> {
    return this.http.request<NotificationPreferenceDto>('/customer/notifications/preferences', {
      method: 'PATCH',
      body,
    });
  }
}

export class SearchClient {
  public constructor(private readonly http: HttpClient) {}

  public search(query: SearchQuery): Promise<SearchResultDto> {
    return this.http.request<SearchResultDto>(
      `/search${toQuery({
        q: query.q,
        entityType: query.entityType,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
      { auth: false },
    );
  }

  public popular(): Promise<string[]> {
    return this.http.request<string[]>('/search/popular', { auth: false });
  }
}

export class ReviewsClient {
  public constructor(private readonly http: HttpClient) {}

  public listForTarget(targetType: string, targetId: string): Promise<PaginatedResult<ReviewDto>> {
    return this.http.request<PaginatedResult<ReviewDto>>(
      `/reviews/${enc(targetType)}/${enc(targetId)}`,
      { auth: false },
    );
  }

  public create(body: CreateReviewRequest): Promise<ReviewDto> {
    return this.http.request<ReviewDto>('/customer/reviews', { method: 'POST', body });
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
    return this.http.request<WishlistDto[]>('/customer/wishlist');
  }

  public create(body: CreateWishlistRequest): Promise<WishlistDto> {
    return this.http.request<WishlistDto>('/customer/wishlist', { method: 'POST', body });
  }

  public addItem(wishlistId: string, body: AddWishlistItemRequest): Promise<WishlistDto> {
    return this.http.request<WishlistDto>(`/customer/wishlist/${enc(wishlistId)}/items`, {
      method: 'POST',
      body,
    });
  }
}

export class PromotionsClient {
  public constructor(private readonly http: HttpClient) {}

  public list(): Promise<PromotionDto[]> {
    return this.http.request<PromotionDto[]>('/promotions', { auth: false });
  }

  public redeem(code: string): Promise<PromotionDto> {
    return this.http.request<PromotionDto>(`/customer/promotions/${enc(code)}/redeem`, {
      method: 'POST',
    });
  }
}

export class LoyaltyClient {
  public constructor(private readonly http: HttpClient) {}

  public account(): Promise<LoyaltyAccountDto> {
    return this.http.request<LoyaltyAccountDto>('/customer/loyalty');
  }

  public redeem(body: RedeemLoyaltyPointsRequest): Promise<LoyaltyAccountDto> {
    return this.http.request<LoyaltyAccountDto>('/customer/loyalty/redeem', { method: 'POST', body });
  }
}

export class WalletClient {
  public constructor(private readonly http: HttpClient) {}

  public customerWallet(): Promise<WalletDto> {
    return this.http.request<WalletDto>('/customer/wallet');
  }

  public ledger(walletId: string): Promise<WalletLedgerEntryDto[]> {
    return this.http.request<WalletLedgerEntryDto[]>(`/wallets/${enc(walletId)}/ledger`);
  }

  public transfer(body: WalletTransferRequest): Promise<WalletLedgerEntryDto> {
    return this.http.request<WalletLedgerEntryDto>('/customer/wallet/transfer', {
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
