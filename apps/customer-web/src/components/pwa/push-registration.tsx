'use client';

import { usePushRegistration } from '@dripplex/hooks';

import { resolveFirebaseVapidKey, resolveFirebaseWebConfig } from '@/lib/firebase-push-config';
import { sdk } from '@/lib/sdk';

/** DPX-CORE-001 Phase D-2 — registers this device for push on login,
 * deregisters on logout. Renders nothing; mounted once in the root
 * layout so it's active on every route. */
export function PushRegistration(): null {
  usePushRegistration({
    devicesClient: sdk.devices,
    firebaseWebConfig: resolveFirebaseWebConfig(),
    vapidKey: resolveFirebaseVapidKey(),
  });

  return null;
}
