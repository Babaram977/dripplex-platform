import { CALL_ALERT_ANDROID_CHANNEL_ID, RIDE_ALERT_ANDROID_CHANNEL_ID } from '@dripplex/types';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationPriority, NotificationType } from '@prisma/client';

import { DeviceRegistryService } from '../device-registry.service';

import type { NotificationProvider, NotificationProviderResult } from './notification-provider';
import type { Notification } from '@prisma/client';
import type { AndroidConfig, Messaging, SendResponse } from 'firebase-admin/messaging';

/**
 * DPX-MOBILE-001 — which Android notification channel each type rings on.
 *
 * Keyed on **type**, not on priority, because the two answer different questions.
 * Priority is how urgently FCM should deliver the message; the channel is which
 * category the person sees in their notification settings and can tune on its own.
 * Sharing one channel across everything urgent would mean a driver silencing some
 * future CRITICAL alert silences ride offers with it — so a new urgent type has to
 * name its own channel here rather than inherit this one by being CRITICAL.
 *
 * A type absent from this map sends no channel at all, which is what every
 * notification did before this: FCM falls back to its own.
 */
const ANDROID_CHANNEL_BY_TYPE: Partial<Record<NotificationType, string>> = {
  [NotificationType.RIDE_OFFERED]: RIDE_ALERT_ANDROID_CHANNEL_ID,
  // DPX-MOBILE-002. Its own channel, exactly as the comment above requires of a
  // new urgent type — and here the reason is concrete: a driver who turns ride
  // requests down to silent between shifts has not asked to stop hearing the
  // passenger phoning them mid-trip.
  [NotificationType.CALL_INCOMING]: CALL_ALERT_ANDROID_CHANNEL_ID,
};

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
    const android = this.androidConfig(notification);
    const response = await this.messaging.sendEach(
      devices.map((device) => ({
        token: device.token,
        notification: { title: notification.title, body: notification.body },
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...(deepLink !== null ? { deepLink } : {}),
        },
        ...(android !== null ? { android } : {}),
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

  /**
   * DPX-MOBILE-001 — Android delivery options, or null to leave FCM's defaults.
   *
   * Two independent decisions, deliberately not folded into one condition:
   * **how urgently to deliver** (from priority) and **how loudly to present**
   * (from type, via its channel). Either alone produces the config; a type could
   * warrant its own channel without being CRITICAL, and CRITICAL alone still
   * earns the delivery guarantees below.
   *
   * ## Delivery — CRITICAL only
   *
   * **Escape Doze.** FCM batches normal-priority messages when the device is
   * idle, which is exactly the state a phone is in when it is face-down on a
   * dashboard. `priority: 'high'` is what makes Android wake for it. Reserved
   * for CRITICAL so it stays what it is meant to be — Google throttles apps
   * that mark everything high-priority.
   *
   * **Expire.** A ride offer rotates to another driver after
   * RIDE_OFFER_TIMEOUT_MS. A push delivered after that opens an offer that no
   * longer exists, which is worse than silence: the driver stops what they are
   * doing, taps, and finds nothing. `ttl` tells FCM to drop it rather than
   * deliver it late, so a phone that was off the network through the whole
   * offer window simply never rings.
   *
   * The TTL comes from `payload.expiresAt`, which the dispatcher puts on the
   * event, rather than from a constant here — the ride module owns how long an
   * offer lives, and a second copy of that number would drift from it.
   *
   * ## Presentation — the channel, and the devices that have none
   *
   * High priority gets a message delivered promptly; it does **not** make it
   * audible. On Android 8+ the sound, the vibration and whether it interrupts at
   * all are properties of the *channel*, so naming one is what turns a prompt
   * delivery into an alert a driver notices. The app creates it at start-up
   * (`ensureRideAlertChannel`) and both sides read the id from `@dripplex/types`,
   * because a channel id the app has not created is not an error — FCM quietly
   * falls back to its own channel, and the alert is silent again.
   *
   * `defaultSound` and `defaultVibrateTimings` are for the devices the channel
   * cannot reach. This app's `minSdk` is 23, and Android 7 and below have no
   * channels at all: there, these two fields are the only thing that makes a
   * notification ring and buzz. On Android 8+ the channel wins and both are
   * ignored, so they cost nothing and cover the older handsets that are common
   * in the launch market.
   */
  private androidConfig(notification: Notification): AndroidConfig | null {
    const urgent = notification.priority === NotificationPriority.CRITICAL;
    const channelId = ANDROID_CHANNEL_BY_TYPE[notification.type];
    if (!urgent && channelId === undefined) {
      return null;
    }

    const remainingMs = urgent ? this.remainingLifetimeMs(notification.payload) : null;
    return {
      ...(urgent ? { priority: 'high' as const } : {}),
      ...(remainingMs !== null ? { ttl: remainingMs } : {}),
      ...(channelId !== undefined
        ? { notification: { channelId, defaultSound: true, defaultVibrateTimings: true } }
        : {}),
    };
  }

  /** Milliseconds until `payload.expiresAt`, or null when the payload carries
   * no expiry. Clamped at zero: a negative TTL is rejected by FCM, and an offer
   * that expired between being queued and being sent should be dropped
   * immediately rather than delivered. */
  private remainingLifetimeMs(payload: Notification['payload']): number | null {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const expiresAt = (payload as Record<string, unknown>)['expiresAt'];
    if (typeof expiresAt !== 'string') {
      return null;
    }
    const expiryMs = Date.parse(expiresAt);
    if (Number.isNaN(expiryMs)) {
      return null;
    }
    return Math.max(0, expiryMs - Date.now());
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
