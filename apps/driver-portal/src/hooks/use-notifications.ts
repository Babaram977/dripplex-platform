'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationListDto, NotificationListQuery } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-CORE-001 — same polling pattern as customer-web's use-notifications.ts,
 * pointed at the driver-scoped /driver/notifications routes via the
 * sdk-driver barrel (see DripplexClient.driverNotifications). */
const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationListQuery) => [...notificationKeys.all, 'list', query] as const,
};

export function useNotifications(
  query: NotificationListQuery = {},
): UseQueryResult<NotificationListDto> {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: () => sdk.notifications.list(query),
    refetchInterval: 60_000,
  });
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
