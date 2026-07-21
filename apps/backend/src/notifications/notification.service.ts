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

/**
 * Provider-agnostic notification port for auth emails and SMS.
 * Production adapters (SendGrid, SES, Termii, etc.) implement this interface.
 */
export interface NotificationService {
  sendPasswordReset(input: PasswordResetNotificationInput): Promise<void>;
  sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void>;
  sendEmailVerification(input: EmailVerificationNotificationInput): Promise<void>;
  sendPhoneOtp(input: PhoneOtpNotificationInput): Promise<void>;
}

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
