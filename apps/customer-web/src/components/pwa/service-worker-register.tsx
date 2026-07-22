'use client';

import * as React from 'react';

/** Registers the RC1 offline fallback service worker (customer-web only). */
export function ServiceWorkerRegister(): null {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const onLoad = (): void => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-blocking: SW is an enhancement for RC1 offline fallback.
      });
    };
    window.addEventListener('load', onLoad);
    return () => {
      window.removeEventListener('load', onLoad);
    };
  }, []);

  return null;
}
