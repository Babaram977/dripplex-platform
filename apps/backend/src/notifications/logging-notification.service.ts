import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import type {
  EmailVerificationNotificationInput,
  NotificationService,
  PasswordChangedNotificationInput,
  PasswordResetNotificationInput,
  PhoneOtpNotificationInput,
} from './notification.service';

/**
 * Development/stub notification adapter. Logs intent without calling a provider.
 * Replace with SES/SendGrid/Termii adapters in a later infrastructure commit.
 */
@Injectable()
export class LoggingNotificationService implements NotificationService {
  constructor(private readonly logger: Logger) {}

  public sendPasswordReset(input: PasswordResetNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'password_reset',
        email: input.email,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Password reset notification dispatched',
    );
    return Promise.resolve();
  }

  public sendPasswordChanged(input: PasswordChangedNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'password_changed',
        email: input.email,
      },
      'Password changed notification dispatched',
    );
    return Promise.resolve();
  }

  public sendEmailVerification(input: EmailVerificationNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'email',
        template: 'email_verification',
        email: input.email,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Email verification notification dispatched',
    );
    return Promise.resolve();
  }

  public sendPhoneOtp(input: PhoneOtpNotificationInput): Promise<void> {
    this.logger.log(
      {
        channel: 'sms',
        template: 'phone_otp',
        phone: input.phone,
        expiresInSeconds: input.expiresInSeconds,
      },
      'Phone OTP notification dispatched',
    );
    return Promise.resolve();
  }
}
