'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SosAlertDto, TriggerSosAlertRequest } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 5 — SOS/Emergency. */
const sosAlertKeys = {
  all: ['driver-sos-alerts'] as const,
};

export function useSosAlerts(): UseQueryResult<SosAlertDto[]> {
  return useQuery({
    queryKey: sosAlertKeys.all,
    queryFn: () => sdk.sosAlerts.listOwn(),
  });
}

export function useTriggerSosAlert(): UseMutationResult<
  SosAlertDto,
  Error,
  TriggerSosAlertRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TriggerSosAlertRequest) => sdk.sosAlerts.trigger(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sosAlertKeys.all });
    },
  });
}
