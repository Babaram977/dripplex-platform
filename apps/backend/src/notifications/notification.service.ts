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
}

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
