import { Module } from '@nestjs/common';

import { LoggingNotificationService } from './logging-notification.service';
import { NOTIFICATION_SERVICE } from './notification.service';

@Module({
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      useClass: LoggingNotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationsModule {}
