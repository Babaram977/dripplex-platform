'use client';

import * as React from 'react';

import { useMarkNotificationRead } from '@/hooks/use-notifications';

/** DPX-CORE-001 Phase D-3 — the app-side half of sw.js's notificationclick
 * handler. That worker can't call an authenticated API itself (no access
 * to the page's in-memory auth token), so it opens/focuses the app at
 * `?readNotification=<id>` instead; this component marks it read once the
 * app is actually running, then strips the param so a refresh doesn't
 * re-fire it. Reads window.location directly (not useSearchParams()) so
 * mounting this in the root layout doesn't force every static route into
 * a Suspense boundary. */
export function ReadNotificationOnOpen(): null {
  const markRead = useMarkNotificationRead();
  const markReadRef = React.useRef(markRead.mutate);
  markReadRef.current = markRead.mutate;

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notificationId = params.get('readNotification');
    if (!notificationId) {
      return;
    }

    markReadRef.current(notificationId);

    params.delete('readNotification');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
    // Runs once per mount — this component only exists to consume a
    // one-shot query param on initial load.
  }, []);

  return null;
}
