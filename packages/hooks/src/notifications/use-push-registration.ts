'use client';

import * as React from 'react';

import { useAuth } from '../auth/use-auth';

import { detectNativePlatform, obtainNativeToken } from './native-push';
import { registerDeviceWithRetry } from './push-registration-service';
import { obtainWebToken } from './web-push';

import type { UsePushRegistrationOptions } from './push-types';

const DEVICE_ID_STORAGE_KEY = 'dripplex.push.deviceTokenId';

/**
 * DPX-CORE-001 Phase D-2 — registers this device for push on login,
 * deregisters it on logout. Native (Capacitor) and web (Firebase JS SDK)
 * paths are both attempted; whichever applies to the current runtime
 * wins, the other is a no-op. Safe to mount unconditionally in any portal
 * app: with no `firebaseWebConfig`/`vapidKey` and no Capacitor shell, this
 * hook does nothing on every render.
 */
export function usePushRegistration(options: UsePushRegistrationOptions): void {
  const { hydrated, isAuthenticated } = useAuth();
  const wasAuthenticated = React.useRef(false);
  const inFlight = React.useRef(false);
  const { devicesClient, firebaseWebConfig, vapidKey } = options;

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (isAuthenticated && !wasAuthenticated.current) {
      wasAuthenticated.current = true;
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      void (async () => {
        try {
          const nativePlatform = await detectNativePlatform();
          const token = nativePlatform
            ? await obtainNativeToken()
            : await obtainWebToken(firebaseWebConfig, vapidKey);
          if (!token) {
            return;
          }
          const registered = await registerDeviceWithRetry(devicesClient, {
            platform: nativePlatform ?? 'WEB',
            token,
          });
          if (registered && typeof window !== 'undefined') {
            window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, registered.id);
          }
        } finally {
          inFlight.current = false;
        }
      })();
      return;
    }

    if (!isAuthenticated && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      if (typeof window === 'undefined') {
        return;
      }
      const deviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (deviceId) {
        window.localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
        void devicesClient.deactivate(deviceId).catch(() => {
          // Best-effort — an orphaned token still self-heals server-side
          // the next time FirebasePushProvider sees FCM report it dead.
        });
      }
    }
  }, [hydrated, isAuthenticated, devicesClient, firebaseWebConfig, vapidKey]);
}
