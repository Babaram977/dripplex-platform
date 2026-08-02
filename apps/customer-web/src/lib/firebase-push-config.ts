import type { FirebaseWebConfig } from '@dripplex/hooks';

/**
 * DPX-CORE-001 Phase D-2 — reads the public Firebase web-app config from
 * env. Returns undefined (not a throw) when any field is unset, so
 * usePushRegistration's web-push path stays a documented no-op in any
 * environment that hasn't configured these yet, exactly like the backend's
 * FirebasePushProvider does for its own credentials.
 */
export function resolveFirebaseWebConfig(): FirebaseWebConfig | undefined {
  const apiKey = process.env['NEXT_PUBLIC_FIREBASE_API_KEY'];
  const authDomain = process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'];
  const projectId = process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
  const messagingSenderId = process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'];
  const appId = process.env['NEXT_PUBLIC_FIREBASE_APP_ID'];

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return undefined;
  }

  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

export function resolveFirebaseVapidKey(): string | undefined {
  return process.env['NEXT_PUBLIC_FIREBASE_VAPID_KEY'] ?? undefined;
}
