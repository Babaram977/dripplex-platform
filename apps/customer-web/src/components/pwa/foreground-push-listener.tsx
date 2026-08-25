'use client';

import {
  playNotificationChime,
  useAuth,
  useForegroundPush,
  vibrateForNotification,
  type ForegroundPushPayload,
} from '@dripplex/hooks';
import { toast } from '@dripplex/ui';
import { useQueryClient } from '@tanstack/react-query';

import { notificationKeys, useSyncAppBadge } from '@/hooks/use-notifications';
import { resolveFirebaseWebConfig } from '@/lib/firebase-push-config';

/** DPX-CORE-001 Phase D-3 — the foreground counterpart to public/sw.js's
 * background handler. Renders nothing; mounted once in the root layout
 * next to <PushRegistration />. Toast is intentionally not clickable
 * here — @dripplex/ui's toast() has no action/onClick support, and
 * adding one would be a shared-component change beyond this pass. The
 * actually-tappable affordances are the OS notification (background,
 * handled in sw.js) and the bell dropdown (handled by the query
 * invalidation below). */
export function ForegroundPushListener(): null {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  useSyncAppBadge();

  useForegroundPush({
    // Only subscribe once signed in — logged-out visitors never have a
    // registered device (usePushRegistration only registers on login),
    // so there's nothing for this listener to receive.
    firebaseWebConfig: isAuthenticated ? resolveFirebaseWebConfig() : undefined,
    onNotification: (payload: ForegroundPushPayload) => {
      toast({
        title: payload.title ?? 'DrippleX',
        ...(payload.body !== undefined ? { description: payload.body } : {}),
      });
      playNotificationChime();
      vibrateForNotification();
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  return null;
}
