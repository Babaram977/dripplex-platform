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
