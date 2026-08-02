import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminNotificationsController } from './admin-notifications.controller';
import { CustomerDevicesController } from './customer-devices.controller';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { DeviceRegistryService } from './device-registry.service';
import { NotificationCenterService } from './notification-center.service';
import { NotificationCenterSubscriber } from './notification-center.subscriber';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotConfiguredProvider } from './providers/not-configured.provider';
import { EMAIL_PROVIDER, PUSH_PROVIDER, SMS_PROVIDER } from './providers/notification-provider';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [
    CustomerNotificationsController,
    CustomerDevicesController,
    AdminNotificationsController,
  ],
  providers: [
    NotificationCenterService,
    NotificationPreferencesService,
    NotificationTemplateService,
    NotificationCenterSubscriber,
    DeviceRegistryService,
    // Default bindings until real provider credentials exist (Phase D —
    // see docs/DPX-CORE-001-NOTIFICATION-PLATFORM.md). Swapping in a real
    // FCM/APNs, email, or SMS adapter later means changing only these
    // three factories — every caller of NotificationCenterService is
    // unaffected.
    { provide: PUSH_PROVIDER, useFactory: () => new NotConfiguredProvider('fcm') },
    { provide: EMAIL_PROVIDER, useFactory: () => new NotConfiguredProvider('email') },
    { provide: SMS_PROVIDER, useFactory: () => new NotConfiguredProvider('sms') },
  ],
  exports: [NotificationCenterService, NotificationPreferencesService, NotificationTemplateService],
})
export class NotificationCenterModule {}
