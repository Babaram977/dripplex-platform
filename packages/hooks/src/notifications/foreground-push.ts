import type { FirebaseWebConfig } from './push-types';

export interface ForegroundPushPayload {
  notificationId?: string;
  title?: string;
  body?: string;
  deepLink?: string;
}

/** Subscribes to Firebase's onMessage() — the foreground-only counterpart
 * to public/sw.js's onBackgroundMessage(). Returns null (no subscription)
 * when web push isn't configured or supported, so callers can treat "no
 * unsubscribe function" as "nothing to clean up" rather than an error. */
export async function listenForForegroundMessages(
  config: FirebaseWebConfig | undefined,
  onPayload: (payload: ForegroundPushPayload) => void,
): Promise<(() => void) | null> {
  if (typeof window === 'undefined' || !config) {
    return null;
  }

  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) {
    return null;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const messaging = getMessaging(app);

  return onMessage(messaging, (message) => {
    const notificationId = message.data?.['notificationId'];
    const title = message.notification?.title;
    const body = message.notification?.body;
    const deepLink = message.data?.['deepLink'];
    onPayload({
      ...(notificationId !== undefined ? { notificationId } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(deepLink !== undefined ? { deepLink } : {}),
    });
  });
}
