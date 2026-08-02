'use client';

import { setAppBadgeCount, useAuth } from '@dripplex/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import type { NotificationListDto, NotificationListQuery } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-CORE-001 — first real consumer of sdk.notifications.*, previously
 * wired end-to-end (backend, SDK, types) but never used by any UI. */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationListQuery) => [...notificationKeys.all, 'list', query] as const,
};

export function useNotifications(
  query: NotificationListQuery = {},
  options: { enabled?: boolean } = {},
): UseQueryResult<NotificationListDto> {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: () => sdk.notifications.list(query),
    refetchInterval: 60_000,
    enabled: options.enabled ?? true,
  });
}

/** Cheap unread badge count — reuses the same list endpoint with unreadOnly + limit:1, reading `total`. */
export function useUnreadNotificationCount(): number {
  const { data } = useNotifications({ unreadOnly: true, limit: 1 });
  return data?.total ?? 0;
}

/** DPX-CORE-001 Phase D-3 — mirrors the unread count onto the OS-level app
 * icon badge (Web Badging API / Capacitor-wrapped shell) whenever it
 * changes. Gated on isAuthenticated since — unlike the bell, which only
 * ever mounts inside the authenticated dashboard layout — this is mounted
 * app-wide in the root layout, including public/logged-out routes. */
export function useSyncAppBadge(): void {
  const { isAuthenticated } = useAuth();
  const { data } = useNotifications({ unreadOnly: true, limit: 1 }, { enabled: isAuthenticated });
  const unreadCount = data?.total ?? 0;

  React.useEffect(() => {
    if (!isAuthenticated) {
      void setAppBadgeCount(0);
      return;
    }
    void setAppBadgeCount(unreadCount);
  }, [isAuthenticated, unreadCount]);
}

export function useMarkNotificationRead(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.notifications.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead(): UseMutationResult<{ updated: number }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.notifications.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
