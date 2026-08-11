'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DecideInspectionRequest,
  InspectionDto,
  InspectionStatus,
  PaginatedResult,
  RecordInspectionChecklistRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const inspectionKeys = {
  listPrefix: ['admin-inspections'] as const,
  list: (status: InspectionStatus | 'ALL') => ['admin-inspections', status] as const,
  detail: (id: string) => ['admin-inspection', id] as const,
};

/** DPX-DRIVER-002 Phase 3 — inspection queue for the Ops Console. Defaults to
 * the full list; pass a status to scope to a queue. */
export function useInspections(
  status?: InspectionStatus,
): UseQueryResult<PaginatedResult<InspectionDto>> {
  return useQuery({
    queryKey: inspectionKeys.list(status ?? 'ALL'),
    queryFn: () => sdk.operationsInspections.list(status !== undefined ? { status } : {}),
    refetchInterval: 15_000,
  });
}

export function useInspection(id: string): UseQueryResult<InspectionDto> {
  return useQuery({
    queryKey: inspectionKeys.detail(id),
    queryFn: () => sdk.operationsInspections.get(id),
  });
}

function useInspectionMutation<TArgs, TResult>(
  id: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inspectionKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: inspectionKeys.listPrefix });
    },
  });
}

/** Officer capability (`inspection:checklist:manage`). */
export function useRecordChecklist(
  id: string,
): UseMutationResult<InspectionDto, Error, RecordInspectionChecklistRequest> {
  return useInspectionMutation(id, (body: RecordInspectionChecklistRequest) =>
    sdk.operationsInspections.recordChecklist(id, body),
  );
}

/** Supervisor capability (`inspection:approve`). */
export function useDecideInspection(
  id: string,
): UseMutationResult<InspectionDto, Error, DecideInspectionRequest> {
  return useInspectionMutation(id, (body: DecideInspectionRequest) =>
    sdk.operationsInspections.decide(id, body),
  );
}
