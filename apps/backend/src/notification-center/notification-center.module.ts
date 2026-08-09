import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigService } from '../config/app-config.service';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminNotificationsController } from './admin-notifications.controller';
import { CustomerDevicesController } from './customer-devices.controller';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { DeviceRegistryService } from './device-registry.service';
import { DriverNotificationsController } from './driver-notifications.controller';
import { MerchantNotificationsController } from './merchant-notifications.controller';
import { MerchantOrderNotificationSubscriber } from './merchant-order-notification.subscriber';
import { NotificationCenterService } from './notification-center.service';
import { NotificationCenterSubscriber } from './notification-center.subscriber';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { getFirebaseMessaging } from './providers/firebase-admin.factory';
import { FirebasePushProvider } from './providers/firebase-push.provider';
import { NotConfiguredProvider } from './providers/not-configured.provider';
import { EMAIL_PROVIDER, PUSH_PROVIDER, SMS_PROVIDER } from './providers/notification-provider';

import type { NotificationProvider } from './providers/notification-provider';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [
    CustomerNotificationsController,
    CustomerDevicesController,
    DriverNotificationsController,
    MerchantNotificationsController,
    AdminNotificationsController,
  ],
  providers: [
    NotificationCenterService,
    NotificationPreferencesService,
    NotificationTemplateService,
    NotificationCenterSubscriber,
    MerchantOrderNotificationSubscriber,
    DeviceRegistryService,
    // Default bindings until real provider credentials exist (Phase D —
    // see docs/DPX-CORE-001-NOTIFICATION-PLATFORM.md). Swapping in a real
    // FCM/APNs, email, or SMS adapter later means changing only these
    // three factories — every caller of NotificationCenterService is
    // unaffected. PUSH is now real: FirebasePushProvider binds whenever
    // FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are set, falling back to
    // NotConfiguredProvider otherwise so an unconfigured environment keeps
    // behaving exactly as before.
    {
      provide: PUSH_PROVIDER,
      useFactory: async (
        config: AppConfigService,
        deviceRegistry: DeviceRegistryService,
      ): Promise<NotificationProvider> => {
        if (!config.firebaseConfigured) {
          return new NotConfiguredProvider('fcm');
        }
        const messaging = await getFirebaseMessaging(config);
        return new FirebasePushProvider(messaging, deviceRegistry);
      },
      inject: [AppConfigService, DeviceRegistryService],
    },
    { provide: EMAIL_PROVIDER, useFactory: () => new NotConfiguredProvider('email') },
    { provide: SMS_PROVIDER, useFactory: () => new NotConfiguredProvider('sms') },
  ],
  exports: [NotificationCenterService, NotificationPreferencesService, NotificationTemplateService],
})
export class NotificationCenterModule {}
