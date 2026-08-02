'use client';

import * as React from 'react';

import { listenForNativeNotificationTaps, type NativeNotificationTapPayload } from './native-push';

/** DPX-CORE-001 Phase D-3 — subscribes to Capacitor notification taps for
 * as long as this is mounted. A no-op outside a native shell. */
export function useNativeNotificationTap(
  onTap: (payload: NativeNotificationTapPayload) => void,
): void {
  const onTapRef = React.useRef(onTap);
  onTapRef.current = onTap;

  React.useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void listenForNativeNotificationTaps((payload) => {
      onTapRef.current(payload);
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
  }, []);
}
