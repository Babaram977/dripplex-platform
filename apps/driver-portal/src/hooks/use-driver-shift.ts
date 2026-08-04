'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DriverShiftDto, DriverShiftSummaryDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 6 — Shift Management. `useShiftSummary` polls
 * periodically so the live continuous-driving/today's-total figures and
 * advisory safety banners stay current without the driver refreshing. */
const shiftKeys = {
  summary: ['driver-shift-summary'] as const,
  history: ['driver-shift-history'] as const,
};

export function useShiftSummary(): UseQueryResult<DriverShiftSummaryDto> {
  return useQuery({
    queryKey: shiftKeys.summary,
    queryFn: () => sdk.shifts.getSummary(),
    refetchInterval: 60_000,
  });
}

export function useShiftHistory(): UseQueryResult<DriverShiftDto[]> {
  return useQuery({
    queryKey: shiftKeys.history,
    queryFn: () => sdk.shifts.listOwn(),
  });
}

function useShiftMutation(
  mutationFn: () => Promise<DriverShiftDto>,
): UseMutationResult<DriverShiftDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: shiftKeys.summary });
      void queryClient.invalidateQueries({ queryKey: shiftKeys.history });
    },
  });
}

export function useStartShift(): UseMutationResult<DriverShiftDto, Error, void> {
  return useShiftMutation(() => sdk.shifts.start());
}

export function useStartBreak(): UseMutationResult<DriverShiftDto, Error, void> {
  return useShiftMutation(() => sdk.shifts.startBreak());
}

export function useEndBreak(): UseMutationResult<DriverShiftDto, Error, void> {
  return useShiftMutation(() => sdk.shifts.endBreak());
}

export function useEndShift(): UseMutationResult<DriverShiftDto, Error, void> {
  return useShiftMutation(() => sdk.shifts.end());
}
