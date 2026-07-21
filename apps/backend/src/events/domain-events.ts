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
  MERCHANT_APPROVED: 'MerchantApproved',
  RIDER_APPROVED: 'RiderApproved',
  INVENTORY_LOW: 'InventoryLow',
  INVENTORY_OUT_OF_STOCK: 'InventoryOutOfStock',
  PASSWORD_RESET: 'PasswordReset',
  OTP_REQUESTED: 'OTPRequested',
  NOTIFICATION_FAILED: 'NotificationFailed',
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
