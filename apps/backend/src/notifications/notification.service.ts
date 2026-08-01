export interface PasswordResetNotificationInput {
  email: string;
  resetToken: string;
  otp: string;
  expiresInSeconds: number;
}

export interface PasswordChangedNotificationInput {
  email: string;
}

export interface EmailVerificationNotificationInput {
  email: string;
  verificationToken: string;
  expiresInSeconds: number;
}

export interface PhoneOtpNotificationInput {
  phone: string;
  otp: string;
  expiresInSeconds: number;
}

export type MerchantLifecycleEvent =
  | 'business_submitted'
  | 'kyc_submitted'
  | 'merchant_approved'
  | 'merchant_rejected'
  | 'merchant_suspended'
  | 'merchant_reactivated';

export interface MerchantLifecycleNotificationInput {
  email: string;
  event: MerchantLifecycleEvent;
  merchantId: string;
  businessName?: string;
  documentType?: string;
  reason?: string;
}

export interface OrderCreatedNotificationInput {
  audience: 'customer' | 'merchant';
  email: string;
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
}

export interface PaymentResultNotificationInput {
  audience: 'customer' | 'merchant';
  email: string;
  success: boolean;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  reference: string;
}

export type DeliveryLifecycleEvent =
  'rider_assigned' | 'picked_up' | 'arriving' | 'delivered' | 'new_assignment';

export interface DeliveryLifecycleNotificationInput {
  audience: 'customer' | 'merchant' | 'rider';
  email: string;
  event: DeliveryLifecycleEvent;
  orderId: string;
  orderNumber: string;
  jobId: string;
}

export type DriverLifecycleEvent =
  | 'kyc_submitted'
  | 'driver_approved'
  | 'driver_rejected'
  | 'driver_suspended'
  | 'driver_reactivated';

export interface DriverLifecycleNotificationInput {
  email: string;
  event: DriverLifecycleEvent;
  driverId: string;
  documentType?: string;
  reason?: string;
}

export type RideLifecycleEvent =
  | 'ride_offered'
  | 'ride_assigned'
  | 'ride_no_drivers_found'
  | 'ride_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'ride_payment_succeeded'
  | 'ride_payment_failed';

export interface RideLifecycleNotificationInput {
  audience: 'customer' | 'driver';
  email: string;
  event: RideLifecycleEvent;
  rideId: string;
}

export interface RideEarningNotificationInput {
  email: string;
  rideId: string;
  amount: number;
  currency: string;
}

/**
 * Provider-agnostic notification port for auth emails and SMS.
 * Production adapters (SendGrid, SES, Termii, etc.) implement this interface.
 */
export interface NotificationService {
  sendPasswordReset(input: PasswordResetNotificationInput): Promise<void>;
  sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void>;
  sendEmailVerification(input: EmailVerificationNotificationInput): Promise<void>;
  sendPhoneOtp(input: PhoneOtpNotificationInput): Promise<void>;
  notifyMerchantLifecycle(input: MerchantLifecycleNotificationInput): Promise<void>;
  notifyOrderCreated(input: OrderCreatedNotificationInput): Promise<void>;
  notifyPaymentResult(input: PaymentResultNotificationInput): Promise<void>;
  notifyDeliveryLifecycle(input: DeliveryLifecycleNotificationInput): Promise<void>;
  notifyDriverLifecycle(input: DriverLifecycleNotificationInput): Promise<void>;
  notifyRideLifecycle(input: RideLifecycleNotificationInput): Promise<void>;
  notifyRideEarning(input: RideEarningNotificationInput): Promise<void>;
}

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
