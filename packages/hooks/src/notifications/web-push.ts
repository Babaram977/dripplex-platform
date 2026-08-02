import type { FirebaseWebConfig } from './push-types';

/** Requests browser notification permission and returns a web FCM
 * registration token, or null if unsupported/unconfigured/denied — never
 * rejects, since "no web push available here" is a normal outcome (SSR,
 * unsupported browser, or FIREBASE_* web config not set yet). */
export async function obtainWebToken(
  config: FirebaseWebConfig | undefined,
  vapidKey: string | undefined,
): Promise<string | null> {
  if (
    typeof window === 'undefined' ||
    typeof Notification === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return null;
  }
  if (!config || !vapidKey) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  const { initializeApp, getApps, getApp } = await import('firebase/app');
  // getToken is deprecated in favor of the FID-based register()/onRegistered()
  // flow, but DeviceToken (and the backend's Messaging.sendEach) expects a
  // classic FCM registration token, not a Firebase Installation ID — the
  // same constraint documented server-side in firebase-push.provider.ts.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) {
    return null;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const messaging = getMessaging(app);
  const registration = await navigator.serviceWorker.register('/sw.js');
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}
