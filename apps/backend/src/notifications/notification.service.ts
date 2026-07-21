export interface PasswordResetNotificationInput {
  email: string;
  resetToken: string;
  otp: string;
  expiresInSeconds: number;
}

export interface PasswordChangedNotificationInput {
  email: string;
}

/**
 * Provider-agnostic notification port for auth emails.
 * Production adapters (SendGrid, SES, etc.) implement this interface.
 */
export interface NotificationService {
  sendPasswordReset(input: PasswordResetNotificationInput): Promise<void>;
  sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void>;
}

export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
