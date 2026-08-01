export type NotificationStatus =
  'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type NotificationType =
  | 'ORDER_PLACED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'RIDER_ASSIGNED'
  | 'DELIVERY_COMPLETED'
  | 'REFUND'
  | 'PROMOTION'
  | 'OTP'
  | 'PASSWORD_RESET'
  | 'WELCOME'
  | 'LOW_INVENTORY'
  | 'MERCHANT_APPROVAL'
  | 'RIDER_APPROVAL'
  | 'BACK_IN_STOCK'
  | 'PRICE_DROP'
  | 'GENERIC';

export interface NotificationDto {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  body: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceDto {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListQuery {
  status?: NotificationStatus;
  channel?: NotificationChannel;
  type?: NotificationType;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface NotificationListDto {
  items: NotificationDto[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateNotificationPreferenceRequest {
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
}

export interface UpdateNotificationPreferencesRequest {
  preferences: UpdateNotificationPreferenceRequest[];
}

export type SearchEntityType = 'PRODUCT' | 'STORE' | 'CATEGORY' | 'BRAND' | 'TAG';
export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';

export interface SearchDocumentDto {
  id: string;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  keywords: string[];
  metadata: unknown;
  rankingScore: number;
  available: boolean;
  price: number | null;
  rating: number | null;
  merchantId: string | null;
  categoryId: string | null;
  brandId: string | null;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  q?: string;
  type?: SearchEntityType;
  page?: number;
  limit?: number;
  sort?: SearchSort;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  merchantId?: string;
  categoryId?: string;
  available?: boolean;
}

export interface SearchResultDto {
  items: SearchDocumentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchSuggestionQuery {
  q?: string;
  limit?: number;
}

export interface SearchAutocompleteQuery extends SearchSuggestionQuery {
  q: string;
  type?: SearchEntityType;
}

export interface PopularSearchDto {
  id: string;
  query: string;
  hitCount: number;
  updatedAt: string;
}

export interface RecentSearchDto {
  id: string;
  userId: string;
  query: string;
  createdAt: string;
}

export type ReviewTargetType = 'PRODUCT' | 'MERCHANT' | 'RIDER';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';

export interface ReviewDto {
  id: string;
  authorId: string;
  targetType: ReviewTargetType;
  targetId: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  photos: string[];
  verifiedPurchase: boolean;
  status: ReviewStatus;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  helpfulCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewRequest {
  targetType: ReviewTargetType;
  targetId: string;
  orderId?: string;
  rating: number;
  comment?: string;
  photos?: string[];
}

export interface ReplyToReviewRequest {
  reply: string;
}

export interface ReviewListQuery {
  targetType?: ReviewTargetType;
  targetId?: string;
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
}

export interface ReviewListDto {
  items: ReviewDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ReviewAggregateDto {
  targetType: ReviewTargetType;
  targetId: string;
  averageRating: number;
  reviewCount: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
  updatedAt: string;
}

export interface ReviewWithAggregateDto extends ReviewListDto {
  aggregate: ReviewAggregateDto | null;
}

export type WishlistItemType = 'PRODUCT' | 'STORE' | 'COLLECTION';

export interface WishlistItemDto {
  id: string;
  wishlistId: string;
  itemType: WishlistItemType;
  itemId: string;
  targetPrice: number | null;
  notifyPriceDrop: boolean;
  notifyBackInStock: boolean;
  addedAt: string;
}

export interface WishlistDto {
  id: string;
  customerId: string;
  name: string;
  shareToken: string | null;
  isPublic: boolean;
  items: WishlistItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWishlistRequest {
  name: string;
}

export interface UpdateWishlistRequest {
  name?: string;
  isPublic?: boolean;
}

export interface AddWishlistItemRequest {
  itemType: WishlistItemType;
  itemId: string;
  targetPrice?: number;
  notifyPriceDrop?: boolean;
  notifyBackInStock?: boolean;
}

export interface UpdateWishlistItemRequest {
  targetPrice?: number;
  notifyPriceDrop?: boolean;
  notifyBackInStock?: boolean;
}

export interface MoveWishlistToCartProductRequest {
  productId: string;
  merchantId: string;
  variantId?: string;
  productName: string;
  sku?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity?: number;
  currency?: string;
}

export interface MoveWishlistToCartRequest {
  products?: MoveWishlistToCartProductRequest[];
}

export interface MoveWishlistToCartResultDto {
  wishlistId: string;
  productIds: string[];
  addedToCart: string[];
}

export type PromotionType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'BOGO'
  | 'FLASH_SALE'
  | 'HAPPY_HOUR'
  | 'MERCHANT_CAMPAIGN'
  | 'PLATFORM_CAMPAIGN'
  | 'REFERRAL'
  | 'COUPON'
  | 'AUTOMATIC';
export type PromotionStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export interface PromotionDto {
  id: string;
  code: string | null;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  percentOff: number | null;
  amountOff: number | null;
  buyQty: number | null;
  getQty: number | null;
  priority: number;
  stackable: boolean;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  minOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  merchantId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListQuery {
  merchantId?: string;
  status?: PromotionStatus;
}

export interface PromotionDiscountDto {
  promotionId: string;
  code: string | null;
  name: string;
  type: PromotionType;
  priority: number;
  stackable: boolean;
  discountAmount: number;
}

export interface PromotionEvaluationDto {
  subtotal: number;
  discountTotal: number;
  discounts: PromotionDiscountDto[];
  couponCode: string | null;
  valid: boolean;
}

export interface ValidatePromotionRequest {
  subtotal: number;
  merchantId?: string;
  couponCode?: string;
}

export interface RedeemPromotionRequest {
  promotionId?: string;
  couponCode?: string;
  orderId: string;
}

export interface PromotionRedemptionDto {
  id: string;
  promotionId: string;
  userId: string;
  orderId: string | null;
  amountSaved: number;
  createdAt: string;
}

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP';

export interface LoyaltyAccountDto {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerEntryDto {
  id: string;
  accountId: string;
  points: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface RedeemLoyaltyPointsRequest {
  points: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}

export type WalletOwnerType = 'CUSTOMER' | 'MERCHANT' | 'RIDER' | 'DRIVER' | 'PLATFORM';
export type WalletTransactionType =
  'CREDIT' | 'DEBIT' | 'REFUND' | 'SETTLEMENT' | 'CASHBACK' | 'WITHDRAWAL' | 'TRANSFER';
export type WalletDirection = 'CREDIT' | 'DEBIT';

export interface WalletDto {
  id: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerEntryDto {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  direction: WalletDirection;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface WalletHistoryQuery {
  page?: number;
  pageSize?: number;
}

export interface WalletTransferRequest {
  toUserId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface WalletTransferDto {
  source: WalletDto;
  destination: WalletDto;
}

export interface AdminWalletMutationRequest {
  amount: number;
  currency?: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface WalletReconciliationQuery {
  ownerType: WalletOwnerType;
  ownerId: string;
  currency?: string;
}

export interface WalletReconciliationDto {
  wallet: WalletDto;
  ledgerBalance: number;
  availableBalance: number;
  difference: number;
  reconciled: boolean;
}

export type AnalyticsScopeType = 'PLATFORM' | 'MERCHANT' | 'RIDER';

export interface AnalyticsDailyMetricDto {
  id: string;
  metricDate: string;
  scopeType: AnalyticsScopeType;
  scopeId: string | null;
  metricKey: string;
  metricValue: number;
  metadata: unknown;
  createdAt: string;
}

export interface AnalyticsQuery {
  scopeType?: AnalyticsScopeType;
  scopeId?: string;
  metricKey?: string;
  from?: string;
  to?: string;
}

export type CmsContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type CmsContentType =
  | 'HOMEPAGE_BANNER'
  | 'CATEGORY'
  | 'LANDING_PAGE'
  | 'FAQ'
  | 'STATIC_PAGE'
  | 'ANNOUNCEMENT'
  | 'PROMO_BANNER'
  | 'MARKETING_BLOCK';

export interface CmsContentVersionDto {
  id: string;
  contentId: string;
  version: number;
  title: string;
  body: unknown;
  createdBy: string | null;
  createdAt: string;
}

export interface CmsContentDto {
  id: string;
  type: CmsContentType;
  slug: string;
  title: string;
  body: unknown;
  status: CmsContentStatus;
  version: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versions: CmsContentVersionDto[];
}

export interface CreateCmsContentRequest {
  type: CmsContentType;
  slug: string;
  title: string;
  body?: unknown;
}

export interface UpdateCmsContentRequest {
  type?: CmsContentType;
  slug?: string;
  title?: string;
  body?: unknown;
}

export interface ScheduleCmsContentRequest {
  scheduledAt: string;
}

export interface CmsContentListQuery {
  type?: CmsContentType;
  status?: CmsContentStatus;
  page?: number;
  pageSize?: number;
}

export type FraudRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FraudReviewStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLEARED' | 'CONFIRMED_FRAUD';
export type FraudListType = 'BLACKLIST' | 'WHITELIST';
export type FraudMatchType = 'USER' | 'IP' | 'DEVICE' | 'EMAIL';

export interface FraudSignalDto {
  id: string;
  userId: string | null;
  orderId: string | null;
  paymentId: string | null;
  signalType: string;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  details: unknown;
  ipAddress: string | null;
  deviceFingerprint: string | null;
  status: FraudReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FraudThresholdDto {
  id: string;
  key: string;
  value: number;
  description: string | null;
  updatedAt: string;
}

export interface FraudListEntryDto {
  id: string;
  listType: FraudListType;
  matchType: FraudMatchType;
  matchValue: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EvaluateOrderRiskInput {
  userId?: string;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  email?: string;
  billingCountry?: string;
  shippingCountry?: string;
}

export interface FraudEvaluationResult {
  riskScore: number;
  riskLevel: FraudRiskLevel;
  /**
   * Always `false` in S1-C14→C23 observational mode.
   * Reserved for a future enforcement phase that can block checkout/payment.
   */
  blocked: boolean;
  reasons: string[];
  signal: FraudSignalDto;
}

export interface FraudQueueQuery {
  status?: FraudReviewStatus;
  riskLevel?: FraudRiskLevel;
  userId?: string;
  page?: number;
  pageSize?: number;
}

export interface ReviewFraudSignalRequest {
  status: FraudReviewStatus;
  note?: string;
}

export interface UpsertFraudThresholdRequest {
  value: number;
  description?: string;
}

export interface FraudListEntryQuery {
  listType?: FraudListType;
  matchType?: FraudMatchType;
  active?: boolean;
}

export interface CreateFraudListEntryRequest {
  listType: FraudListType;
  matchType: FraudMatchType;
  matchValue: string;
  reason?: string;
}

export interface UpdateFraudListEntryRequest {
  listType?: FraudListType;
  matchType?: FraudMatchType;
  matchValue?: string;
  reason?: string;
  active?: boolean;
}
