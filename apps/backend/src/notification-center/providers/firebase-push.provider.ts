import { Injectable, Logger } from '@nestjs/common';

import { DeviceRegistryService } from '../device-registry.service';

import type { NotificationProvider, NotificationProviderResult } from './notification-provider';
import type { Notification } from '@prisma/client';
import type { Messaging, SendResponse } from 'firebase-admin/messaging';

/**
 * Real FCM adapter, bound in place of NotConfiguredProvider once
 * FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are set (see
 * notification-center.module.ts's PUSH_PROVIDER factory, which resolves
 * `Messaging` once via `getMessaging(app)` rather than this class doing it,
 * so tests can inject a fake `Messaging` instead of mocking the SDK
 * module). Fans a push out to every active DeviceToken for the
 * notification's user — mirrors DeviceRegistryService's documented
 * multi-device semantics.
 *
 * A token FCM reports as unregistered/invalid is deactivated immediately,
 * since retrying it can never succeed and it would otherwise get resent on
 * every future push to that user.
 */
@Injectable()
export class FirebasePushProvider implements NotificationProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);

  constructor(
    private readonly messaging: Messaging,
    private readonly deviceRegistry: DeviceRegistryService,
  ) {}

  public async send(notification: Notification): Promise<NotificationProviderResult> {
    const devices = await this.deviceRegistry.list(notification.userId);
    if (devices.length === 0) {
      // Not a delivery failure — the provider is configured and reachable,
      // the user simply hasn't registered a device yet. Matches how an
      // opted-out channel is treated: a real, successful no-op, not an
      // "unconfigured provider" dead-letter.
      return { configured: true, provider: 'fcm' };
    }

    // sendEach (not the deprecated sendEachForMulticast) — each message
    // carries its own `token` since DeviceToken stores classic FCM
    // registration tokens, not Firebase Installation IDs (fids), which is
    // what the newer FidMulticastMessage overload expects instead.
    const deepLink = this.extractDeepLink(notification.payload);
    const response = await this.messaging.sendEach(
      devices.map((device) => ({
        token: device.token,
        notification: { title: notification.title, body: notification.body },
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...(deepLink !== null ? { deepLink } : {}),
        },
      })),
    );

    await this.deactivateInvalidTokens(
      devices.map((device) => device.id),
      notification.userId,
      response.responses,
    );

    const firstSuccess = response.responses.find((result) => result.success);
    return {
      configured: true,
      provider: 'fcm',
      ...(firstSuccess?.messageId !== undefined
        ? { providerMessageId: firstSuccess.messageId }
        : {}),
    };
  }

  /** FCM `data` values must all be strings, so this reads the same
   * `payload.deepLink` the subscriber writes (notification-center.subscriber.ts)
   * out of the loosely-typed Prisma `Json` column, rather than trusting
   * its shape. */
  private extractDeepLink(payload: Notification['payload']): string | null {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const deepLink = (payload as Record<string, unknown>)['deepLink'];
    return typeof deepLink === 'string' ? deepLink : null;
  }

  private async deactivateInvalidTokens(
    deviceTokenIds: string[],
    userId: string,
    responses: SendResponse[],
  ): Promise<void> {
    const invalidCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ]);
    const staleIds = responses
      .map((result, index) => ({ result, id: deviceTokenIds[index] }))
      .filter(
        (entry): entry is { result: SendResponse; id: string } =>
          entry.id !== undefined &&
          !entry.result.success &&
          entry.result.error !== undefined &&
          invalidCodes.has(entry.result.error.code),
      );

    await Promise.all(
      staleIds.map(async ({ id }) => {
        try {
          await this.deviceRegistry.deactivate(userId, id);
        } catch (error) {
          this.logger.warn(
            `Failed to deactivate stale device token ${id}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        }
      }),
    );
  }
}
