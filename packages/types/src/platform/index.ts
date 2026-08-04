export type NotificationStatus =
  'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
/** Which module a notification belongs to — orthogonal to NotificationType
 * ("what happened?"); Category answers "which module?". Not derivable from
 * type alone since some types (PAYMENT_SUCCESS, PAYMENT_FAILED) are shared
 * across categories. */
export type NotificationCategory =
  | 'RIDE'
  | 'DELIVERY'
  | 'MARKETPLACE'
  | 'WALLET'
  | 'MERCHANT'
  | 'ADMIN'
  | 'SUPPORT'
  | 'EMERGENCY'
  | 'MARKETING'
  | 'SYSTEM'
  | 'SECURITY';
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
  | 'GENERIC'
  | 'RIDE_DRIVER_ASSIGNED'
  | 'RIDE_DRIVER_ARRIVED'
  | 'RIDE_STARTED'
  | 'RIDE_COMPLETED'
  | 'REFERRAL_REDEEMED'
  | 'REFERRAL_REWARDED'
  | 'DRIVER_REFERRAL_PASSENGER_REGISTERED'
  | 'DRIVER_REFERRAL_PASSENGER_QUALIFIED'
  | 'DRIVER_REFERRAL_TIER_SILVER'
  | 'DRIVER_REFERRAL_TIER_GOLD'
  | 'DRIVER_REFERRAL_REWARD_APPROVED'
  | 'DRIVER_REFERRAL_REWARD_PAID';

/**
 * Event-name mapping for the client's sound abstraction (DPX-CORE-001
 * Phase B) — real audio files are Phase C, not built yet. This is a pure
 * client-side lookup from the already-returned `NotificationDto.type`,
 * not a new backend field: the backend has no `soundEvent` column to add
 * without a real reason, and computing it here means the mapping the
 * founder described ("only the mapping changes") lives in exactly one
 * place, shared by every app that imports `@dripplex/types`.
 */
export type NotificationSoundEvent =
  | 'ride_driver_assigned'
  | 'ride_driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'new_order'
  | 'payment_success'
  | 'payment_failed'
  | 'refund'
  | 'promotion'
  | 'notification'
  | 'warning';

export const NOTIFICATION_SOUND_EVENTS: Record<NotificationType, NotificationSoundEvent> = {
  RIDE_DRIVER_ASSIGNED: 'ride_driver_assigned',
  RIDE_DRIVER_ARRIVED: 'ride_driver_arrived',
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  ORDER_PLACED: 'new_order',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  REFUND: 'refund',
  PROMOTION: 'promotion',
  RIDER_ASSIGNED: 'notification',
  DELIVERY_COMPLETED: 'notification',
  OTP: 'notification',
  PASSWORD_RESET: 'warning',
  WELCOME: 'notification',
  LOW_INVENTORY: 'warning',
  MERCHANT_APPROVAL: 'notification',
  RIDER_APPROVAL: 'notification',
  BACK_IN_STOCK: 'notification',
  PRICE_DROP: 'notification',
  GENERIC: 'notification',
  REFERRAL_REDEEMED: 'promotion',
  REFERRAL_REWARDED: 'payment_success',
  DRIVER_REFERRAL_PASSENGER_REGISTERED: 'notification',
  DRIVER_REFERRAL_PASSENGER_QUALIFIED: 'promotion',
  DRIVER_REFERRAL_TIER_SILVER: 'promotion',
  DRIVER_REFERRAL_TIER_GOLD: 'promotion',
  DRIVER_REFERRAL_REWARD_APPROVED: 'payment_success',
  DRIVER_REFERRAL_REWARD_PAID: 'payment_success',
};

export function getNotificationSoundEvent(type: NotificationType): NotificationSoundEvent {
  return NOTIFICATION_SOUND_EVENTS[type];
}

export interface NotificationDto {
  id: string;
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  body: string;
  payload: unknown;
  expiresAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface DeviceTokenDto {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDeviceTokenRequest {
  platform: DevicePlatform;
  token: string;
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
  category?: NotificationCategory;
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
  | 'AUTOMATIC'
  | 'WALLET_CREDIT'
  | 'CASHBACK'
  | 'FREE_DELIVERY'
  | 'BONUS_REWARD'
  | 'MULTI_BUY'
  | 'THRESHOLD_DISCOUNT';
export type PromotionStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED' | 'CANCELLED';
export type PromotionDomain = 'RIDE' | 'MARKETPLACE' | 'DELIVERY' | 'WALLET' | 'MERCHANT';

export interface PromotionRules {
  eligibleCities?: string[];
  eligibleStates?: string[];
  eligibleCountries?: string[];
  rideTypes?: string[];
  merchantCategories?: string[];
  paymentMethods?: string[];
  weekdays?: number[];
  startHour?: number;
  endHour?: number;
  newUsersOnly?: boolean;
  returningUsersOnly?: boolean;
  referralOnly?: boolean;
  inviteOnly?: boolean;
  whitelistUserIds?: string[];
  blacklistUserIds?: string[];
  eligibleDriverIds?: string[];
  eligibleCustomerIds?: string[];
}

export interface PromotionDto {
  id: string;
  code: string | null;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  domains: PromotionDomain[];
  percentOff: number | null;
  amountOff: number | null;
  creditAmount: number | null;
  maxDiscount: number | null;
  buyQty: number | null;
  getQty: number | null;
  priority: number;
  stackable: boolean;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  perDeviceLimit: number | null;
  minOrderAmount: number | null;
  rules: PromotionRules | null;
  startsAt: string | null;
  endsAt: string | null;
  pausedAt: string | null;
  archivedAt: string | null;
  merchantId: string | null;
  clonedFromId: string | null;
  createdBy: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListQuery {
  merchantId?: string;
  status?: PromotionStatus;
  domain?: PromotionDomain;
}

export interface PromotionDiscountDto {
  promotionId: string;
  code: string | null;
  name: string;
  type: PromotionType;
  priority: number;
  stackable: boolean;
  discountAmount: number;
  creditAmount: number;
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
  deviceId?: string;
}

export interface PromotionRedemptionDto {
  id: string;
  promotionId: string;
  userId: string;
  orderId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  walletTransactionId: string | null;
  amountSaved: number;
  createdAt: string;
}

export interface CreatePromotionRequest {
  code?: string;
  name: string;
  type: PromotionType;
  status?: PromotionStatus;
  domains?: PromotionDomain[];
  percentOff?: number;
  amountOff?: number;
  creditAmount?: number;
  maxDiscount?: number;
  buyQty?: number;
  getQty?: number;
  priority?: number;
  stackable?: boolean;
  usageLimit?: number;
  perUserLimit?: number;
  perDeviceLimit?: number;
  minOrderAmount?: number;
  rules?: PromotionRules;
  startsAt?: string;
  endsAt?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

export type UpdatePromotionRequest = Partial<CreatePromotionRequest>;

export interface CloneCampaignRequest {
  name?: string;
  code?: string;
}

export interface CampaignAnalyticsQuery {
  from?: string;
  to?: string;
}

export interface PromotionAnalyticsDto {
  promotionId: string;
  totalRedemptions: number;
  uniqueUsers: number;
  totalDiscountCost: number;
  usageLimit: number | null;
  usageCount: number;
  redemptionRate: number | null;
}

export interface PromotionLeaderboardEntryDto {
  promotionId: string;
  code: string | null;
  name: string;
  type: string;
  redemptions: number;
  discountCost: number;
}

export type ReferralRedemptionStatus = 'PENDING' | 'REWARDED' | 'EXPIRED';

export interface ReferralDto {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
}

export interface ReferralStatsDto {
  code: string;
  totalRedemptions: number;
  pendingRedemptions: number;
  rewardedRedemptions: number;
}

export interface ReferralRedemptionDto {
  id: string;
  referralId: string;
  refereeUserId: string;
  status: ReferralRedemptionStatus;
  rewardedAt: string | null;
  createdAt: string;
}

export interface AdminReferralRedemptionsQuery {
  status?: ReferralRedemptionStatus;
  page?: number;
  pageSize?: number;
}

export type ReferralCampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
export type ReferralCampaignTier = 'NONE' | 'SILVER' | 'GOLD';
export type PassengerReferralStatus = 'REGISTERED' | 'QUALIFIED';
export type DriverReferralRewardStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
export type ReferralFraudCheckType = 'SELF_REFERRAL' | 'DUPLICATE_REFEREE' | 'MANUAL_FLAG';
export type ReferralFraudCheckStatus = 'CLEARED' | 'FLAGGED' | 'REJECTED';

export interface ReferralCampaignDto {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: ReferralCampaignStatus;
  requiredTripsPerPassenger: number;
  silverThreshold: number;
  silverRewardAmount: number;
  goldThreshold: number;
  goldRewardAmount: number;
  goldQualificationRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriverReferralDto {
  id: string;
  campaignId: string;
  driverId: string;
  code: string;
  createdAt: string;
}

export interface ReferralStatisticsDto {
  invitesSent: number;
  registeredCount: number;
  qualifiedCount: number;
  completedTrips: number;
  currentTier: ReferralCampaignTier;
}

export interface DriverReferralRewardDto {
  id: string;
  campaignId: string;
  driverId: string;
  tier: ReferralCampaignTier;
  amount: number;
  qualifiedPassengerCount: number;
  status: DriverReferralRewardStatus;
  approvedAt: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface DriverCampaignDashboardDto {
  campaign: ReferralCampaignDto | null;
  referral: DriverReferralDto | null;
  statistics: ReferralStatisticsDto | null;
  progressToSilver: number;
  progressToGold: number;
  estimatedRewardAmount: number;
  estimatedTier: ReferralCampaignTier;
  campaignCountdownSeconds: number | null;
  rewardHistory: DriverReferralRewardDto[];
}

export interface ReferralFraudCheckDto {
  id: string;
  passengerReferralId: string | null;
  driverReferralId: string | null;
  checkType: ReferralFraudCheckType;
  status: ReferralFraudCheckStatus;
  details: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface DriverReferralLeaderboardEntryDto {
  driverId: string;
  driverName: string;
  code: string;
  registeredCount: number;
  qualifiedCount: number;
  currentTier: ReferralCampaignTier;
}

/**
 * Driver-facing leaderboard row (GET /driver/referral-campaign/leaderboard)
 * — deliberately narrower than the admin DriverReferralLeaderboardEntryDto
 * above: no referral code, masked name, plus an isCurrentDriver flag so
 * the UI can highlight the viewer's own row.
 */
export interface DriverCampaignLeaderboardEntryDto {
  position: number;
  driverName: string;
  qualifiedCount: number;
  currentTier: ReferralCampaignTier;
  estimatedRewardAmount: number;
  isCurrentDriver: boolean;
}

export interface CreateReferralCampaignRequest {
  name: string;
  periodStart: string;
  periodEnd: string;
  requiredTripsPerPassenger?: number;
  silverThreshold?: number;
  silverRewardAmount?: number;
  goldThreshold?: number;
  goldRewardAmount?: number;
  goldQualificationRate?: number;
}

export interface UpdateCampaignRewardsRequest {
  silverRewardAmount?: number;
  goldRewardAmount?: number;
  silverThreshold?: number;
  goldThreshold?: number;
  goldQualificationRate?: number;
}

export interface ListReferralCampaignsQuery {
  status?: ReferralCampaignStatus;
}

export interface ListDriverRewardsQuery {
  campaignId?: string;
  status?: DriverReferralRewardStatus;
}

export interface ListReferralFraudChecksQuery {
  status?: ReferralFraudCheckStatus;
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
  type?: WalletTransactionType;
}

export interface WalletTransferRequest {
  toUserId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface WalletRecipientDto {
  id: string;
  firstName: string;
  lastName: string;
  maskedPhone: string;
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

/** PAYSTACK | FLUTTERWAVE | MONIEPOINT — same restricted gateway set as
 * order/ride card payments; OPAY has no initializePayment support today. */
export type WalletFundingProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'MONIEPOINT';

export interface FundWalletRequest {
  amount: number;
  provider?: WalletFundingProvider;
  callbackUrl?: string;
}

export interface FundWalletResponse {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyWalletFundingRequest {
  reference?: string;
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
