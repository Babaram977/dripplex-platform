'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { operationsQueueKeys } from './use-operations-queues';

import type {
  AddOperationsCaseNoteRequest,
  OperationsCaseDetailDto,
  UpdateOperationsCaseRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 2 — a single work-queue case. `useUpdateCase`/
 * `useAddCaseNote` invalidate all three queue lists on success (not just
 * the one this case belongs to) — cheap given queue sizes, and simpler
 * than threading `caseType` through every call site to invalidate
 * precisely. */
function caseKey(caseId: string): readonly ['operations-case', string] {
  return ['operations-case', caseId] as const;
}

export function useCaseDetail(caseId: string): UseQueryResult<OperationsCaseDetailDto> {
  return useQuery({
    queryKey: caseKey(caseId),
    queryFn: () => sdk.operationsCases.getCase(caseId),
    refetchInterval: 15_000,
  });
}

function useCaseMutation<TBody>(
  caseId: string,
  mutationFn: (body: TBody) => Promise<OperationsCaseDetailDto>,
): UseMutationResult<OperationsCaseDetailDto, Error, TBody> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(caseKey(caseId), data);
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.sos });
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.incidents });
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.support });
    },
  });
}

export function useUpdateCase(
  caseId: string,
): UseMutationResult<OperationsCaseDetailDto, Error, UpdateOperationsCaseRequest> {
  return useCaseMutation(caseId, (body) => sdk.operationsCases.updateCase(caseId, body));
}

export function useAddCaseNote(
  caseId: string,
): UseMutationResult<OperationsCaseDetailDto, Error, AddOperationsCaseNoteRequest> {
  return useCaseMutation(caseId, (body) => sdk.operationsCases.addNote(caseId, body));
}
