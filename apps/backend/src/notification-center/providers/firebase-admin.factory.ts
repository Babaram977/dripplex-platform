import type { AppConfigService } from '../../config/app-config.service';
import type { Messaging } from 'firebase-admin/messaging';

const FIREBASE_APP_NAME = 'dripplex-notification-center';

/**
 * Builds (or reuses) a named Firebase Admin app from the configured
 * service-account credentials and returns its Messaging client. Named
 * rather than the default app so it can't collide with an app another
 * module initializes later, and reused across calls since `initializeApp`
 * throws if called twice for the same name (relevant when Nest recreates
 * this module in tests).
 */
export async function getFirebaseMessaging(config: AppConfigService): Promise<Messaging> {
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getMessaging } = await import('firebase-admin/messaging');

  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  const app =
    existing ??
    initializeApp(
      {
        credential: cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          // .env files store the key with literal `\n` escapes.
          privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n'),
        }),
      },
      FIREBASE_APP_NAME,
    );

  return getMessaging(app);
}
