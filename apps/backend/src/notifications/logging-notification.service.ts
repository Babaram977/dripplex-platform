import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import type {
  NotificationService,
  PasswordChangedNotificationInput,
  PasswordResetNotificationInput,
} from './notification.service';

/**
 * Development/stub notification adapter. Logs intent without calling a provider.
 * Replace with SES/SendGrid adapter in a later infrastructure commit.
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
        // Token and OTP are intentionally omitted from structured logs.
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
}
