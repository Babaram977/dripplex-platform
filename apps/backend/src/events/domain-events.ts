export const DOMAIN_EVENTS = {
  CUSTOMER_REGISTERED: 'CustomerRegistered',
  CUSTOMER_VERIFIED: 'CustomerVerified',
  ADDRESS_CREATED: 'AddressCreated',
  PRODUCT_CREATED: 'ProductCreated',
  INVENTORY_CHANGED: 'InventoryChanged',
  CART_UPDATED: 'CartUpdated',
  CHECKOUT_STARTED: 'CheckoutStarted',
  PAYMENT_INITIATED: 'PaymentInitiated',
  PAYMENT_SUCCEEDED: 'PaymentSucceeded',
  PAYMENT_FAILED: 'PaymentFailed',
  ORDER_CREATED: 'OrderCreated',
  ORDER_PAID: 'OrderPaid',
  ORDER_CANCELLED: 'OrderCancelled',
  DELIVERY_ASSIGNED: 'DeliveryAssigned',
  DELIVERY_ACCEPTED: 'DeliveryAccepted',
  DELIVERY_PICKED_UP: 'DeliveryPickedUp',
  DELIVERY_ARRIVED: 'DeliveryArrived',
  DELIVERY_COMPLETED: 'DeliveryCompleted',
  DELIVERY_FAILED: 'DeliveryFailed',
  REVIEW_SUBMITTED: 'ReviewSubmitted',
  WALLET_CREDITED: 'WalletCredited',
  WALLET_DEBITED: 'WalletDebited',
  PROMOTION_CREATED: 'PromotionCreated',
  COUPON_REDEEMED: 'CouponRedeemed',
  CAMPAIGN_ACTIVATED: 'CampaignActivated',
  CAMPAIGN_PAUSED: 'CampaignPaused',
  CAMPAIGN_ARCHIVED: 'CampaignArchived',
  CAMPAIGN_EXPIRED: 'CampaignExpired',
  PROMOTION_REDEEMED: 'PromotionRedeemed',
  CASHBACK_AWARDED: 'CashbackAwarded',
  COUPON_EXPIRED: 'CouponExpired',
  MERCHANT_APPROVED: 'MerchantApproved',
  RIDER_APPROVED: 'RiderApproved',
  INVENTORY_LOW: 'InventoryLow',
  INVENTORY_OUT_OF_STOCK: 'InventoryOutOfStock',
  PASSWORD_RESET: 'PasswordReset',
  OTP_REQUESTED: 'OTPRequested',
  NOTIFICATION_FAILED: 'NotificationFailed',
  RIDE_DRIVER_ASSIGNED: 'RideDriverAssigned',
  RIDE_DRIVER_ARRIVED: 'RideDriverArrived',
  RIDE_STARTED: 'RideStarted',
  RIDE_COMPLETED: 'RideCompleted',
  RIDE_PAYMENT_SUCCEEDED: 'RidePaymentSucceeded',
  RIDE_PAYMENT_FAILED: 'RidePaymentFailed',
  RIDE_REFUNDED: 'RideRefunded',
  REFERRAL_REDEEMED: 'ReferralRedeemed',
  REFERRAL_REWARDED: 'ReferralRewarded',
  DRIVER_REFERRAL_PASSENGER_REGISTERED: 'DriverReferralPassengerRegistered',
  DRIVER_REFERRAL_PASSENGER_QUALIFIED: 'DriverReferralPassengerQualified',
  DRIVER_REFERRAL_TIER_SILVER_REACHED: 'DriverReferralTierSilverReached',
  DRIVER_REFERRAL_TIER_GOLD_REACHED: 'DriverReferralTierGoldReached',
  DRIVER_REFERRAL_REWARD_APPROVED: 'DriverReferralRewardApproved',
  DRIVER_REFERRAL_REWARD_PAID: 'DriverReferralRewardPaid',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DomainEvent<TPayload = Record<string, unknown>> {
  name: string;
  payload: TPayload;
  occurredAt: string;
  actorUserId?: string | null;
  requestId?: string | null;
}

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;
