import { Module } from '@nestjs/common';

import { AppConfigModule } from '../config/config.module';

import { LoggingNotificationService } from './logging-notification.service';
import { NOTIFICATION_SERVICE } from './notification.service';
import { ProductionNotificationService } from './production-notification.service';
import { ResendEmailSender } from './providers/resend-email.sender';
import { TermiiSmsSender } from './providers/termii-sms.sender';

@Module({
  imports: [AppConfigModule],
  providers: [
    LoggingNotificationService,
    TermiiSmsSender,
    ResendEmailSender,
    // ProductionNotificationService activates each channel (SMS via Termii,
    // email via Resend) independently once its own env vars are set,
    // falling back to LoggingNotificationService's log-only behavior
    // per-channel otherwise — see that class's header comment. This is a
    // strict upgrade over the old unconditional LoggingNotificationService
    // binding: an environment with neither key set behaves identically to
    // before.
    {
      provide: NOTIFICATION_SERVICE,
      useClass: ProductionNotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationsModule {}
