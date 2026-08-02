'use client';

import { useNativeNotificationTap, type NativeNotificationTapPayload } from '@dripplex/hooks';
import { useRouter } from 'next/navigation';

import { useMarkNotificationRead } from '@/hooks/use-notifications';

/** DPX-CORE-001 Phase D-3 — native counterpart to
 * <ReadNotificationOnOpen />. Capacitor already foregrounds the app on
 * tap, so this can mark read and navigate directly rather than going
 * through a query-param round trip like the background/web path does. */
export function NativeNotificationTapHandler(): null {
  const router = useRouter();
  const markRead = useMarkNotificationRead();

  useNativeNotificationTap((payload: NativeNotificationTapPayload) => {
    if (payload.notificationId) {
      markRead.mutate(payload.notificationId);
    }
    router.push(payload.deepLink ?? '/dashboard');
  });

  return null;
}
