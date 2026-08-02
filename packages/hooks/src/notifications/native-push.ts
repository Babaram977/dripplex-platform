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
