import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminNotificationsController } from './admin-notifications.controller';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { NotificationCenterService } from './notification-center.service';
import { NotificationCenterSubscriber } from './notification-center.subscriber';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [CustomerNotificationsController, AdminNotificationsController],
  providers: [
    NotificationCenterService,
    NotificationPreferencesService,
    NotificationTemplateService,
    NotificationCenterSubscriber,
  ],
  exports: [NotificationCenterService, NotificationPreferencesService, NotificationTemplateService],
})
export class NotificationCenterModule {}
