'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';

import type {
  NotificationPreferenceDto,
  UpdateNotificationPreferenceRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const preferencesQueryKey = ['notifications', 'preferences'] as const;

export function useNotificationPreferences(): UseQueryResult<NotificationPreferenceDto[]> {
  return useQuery({
    queryKey: preferencesQueryKey,
    queryFn: () => sdk.notifications.preferences(),
  });
}

export function useUpdateNotificationPreferences(): UseMutationResult<
  NotificationPreferenceDto[],
  Error,
  UpdateNotificationPreferenceRequest[]
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: UpdateNotificationPreferenceRequest[]) =>
      sdk.notifications.updatePreferences({ preferences }),
    onSuccess: (data) => {
      queryClient.setQueryData(preferencesQueryKey, data);
    },
  });
}
