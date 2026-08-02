'use client';

import * as React from 'react';

import { listenForForegroundMessages, type ForegroundPushPayload } from './foreground-push';

import type { FirebaseWebConfig } from './push-types';

export interface UseForegroundPushOptions {
  firebaseWebConfig?: FirebaseWebConfig;
  onNotification: (payload: ForegroundPushPayload) => void;
}

/** DPX-CORE-001 Phase D-3 — subscribes to Firebase foreground messages
 * for as long as this is mounted. A no-op when web push isn't configured,
 * same contract as usePushRegistration. */
export function useForegroundPush(options: UseForegroundPushOptions): void {
  const { firebaseWebConfig, onNotification } = options;
  const onNotificationRef = React.useRef(onNotification);
  onNotificationRef.current = onNotification;

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void listenForForegroundMessages(firebaseWebConfig, (payload) => {
      onNotificationRef.current(payload);
    }).then((unsub) => {
      if (cancelled) {
        unsub?.();
        return;
      }
      unsubscribe = unsub;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseWebConfig]);
}
