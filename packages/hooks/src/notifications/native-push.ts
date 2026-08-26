import type { PushDevicePlatform } from './push-types';

/** Returns null on any non-native environment (plain browser) or if
 * @capacitor/core isn't resolvable — a portal that never ships as a
 * Capacitor shell still gets a safe no-op here. */
export async function detectNativePlatform(): Promise<PushDevicePlatform | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return 'IOS';
    }
    if (platform === 'android') {
      return 'ANDROID';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * An Android notification channel, as `@capacitor/push-notifications` defines it.
 *
 * Redeclared here rather than re-exported from the plugin so that an app which
 * does not itself depend on `@capacitor/push-notifications` can still describe a
 * channel. Assignability to the plugin's own `Channel` is checked by the compiler
 * at the `createChannel` call below, so this cannot drift from it silently.
 */
export interface NativeNotificationChannel {
  id: string;
  name: string;
  description?: string;
  /** 0 (none) to 5 (urgent). Anything below 4 will not heads-up. */
  importance?: 0 | 1 | 2 | 3 | 4 | 5;
  /** -1 secret, 0 private, 1 public. */
  visibility?: -1 | 0 | 1;
  /** Filename in the Android app's `res/raw`. Omit for the system default
   * notification sound — a `NotificationChannel` is constructed with it already,
   * and the plugin only overrides that when a filename is supplied. */
  sound?: string;
  vibration?: boolean;
  lights?: boolean;
}

export type CreateChannelOutcome = 'created' | 'not-android' | 'failed';

/**
 * DPX-MOBILE-001 — create an Android notification channel, idempotently.
 *
 * Android decides how loud a notification is from its **channel**, not from the
 * message: importance, sound and vibration are channel properties. Without one,
 * a push lands on FCM's fallback channel at default importance, which is silent
 * heads-up-less shade text — no use to a driver with the phone in their pocket.
 *
 * Three things about channels that shape how callers should use this:
 *
 * - **Creation is one-way.** Re-creating an existing channel does nothing; its
 *   settings belong to the user from the moment it first exists. Calling this on
 *   every launch is therefore both safe and pointless after the first time, which
 *   is exactly what makes it safe to call on every launch.
 * - **Channels are Android-only.** iOS has no equivalent, and the plugin's method
 *   does not exist there.
 * - **Channels are Android 8 (API 26) and up.** This app's `minSdk` is 23, and on
 *   API 23–25 the plugin rejects with `unavailable`. That is reported here as
 *   `'failed'` and is not a problem: pre-O devices have no channels at all and
 *   take their sound and vibration from the message's own fields instead, which
 *   `FirebasePushProvider` sets for that reason.
 *
 * Never throws — a channel that cannot be created is not a reason to break app
 * start-up.
 */
export async function createNativeNotificationChannel(
  channel: NativeNotificationChannel,
): Promise<CreateChannelOutcome> {
  const platform = await detectNativePlatform();
  if (platform !== 'ANDROID') {
    return 'not-android';
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.createChannel(channel);
    return 'created';
  } catch {
    return 'failed';
  }
}

const NATIVE_REGISTRATION_TIMEOUT_MS = 15_000;

/** Requests permission and resolves the native FCM/APNs registration
 * token via @capacitor/push-notifications. Resolves null (never rejects)
 * on denied permission, a registration error, or timeout — callers treat
 * "no token" as a normal, silent outcome, not a failure to surface. */
export async function obtainNativeToken(): Promise<string | null> {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return null;
  }

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(token);
    };
    void PushNotifications.addListener('registration', (token) => {
      finish(token.value);
    });
    void PushNotifications.addListener('registrationError', () => {
      finish(null);
    });
    void PushNotifications.register();
    setTimeout(() => {
      finish(null);
    }, NATIVE_REGISTRATION_TIMEOUT_MS);
  });
}

export interface NativeNotificationTapPayload {
  notificationId?: string;
  deepLink?: string;
}

/** DPX-CORE-001 Phase D-3 — the native counterpart to sw.js's
 * notificationclick. Capacitor already foregrounds the app on tap, so
 * there's no open/focus dance to do here, just read the same
 * notificationId/deepLink data FirebasePushProvider sends. Returns null
 * on non-native platforms, same contract as the rest of this module. */
export async function listenForNativeNotificationTaps(
  onTap: (payload: NativeNotificationTapPayload) => void,
): Promise<(() => void) | null> {
  const platform = await detectNativePlatform();
  if (!platform) {
    return null;
  }

  const { PushNotifications } = await import('@capacitor/push-notifications');
  const handle = await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      const data = (action.notification.data ?? {}) as Record<string, unknown>;
      const notificationId = data['notificationId'];
      const deepLink = data['deepLink'];
      onTap({
        ...(typeof notificationId === 'string' ? { notificationId } : {}),
        ...(typeof deepLink === 'string' ? { deepLink } : {}),
      });
    },
  );

  return () => {
    void handle.remove();
  };
}
