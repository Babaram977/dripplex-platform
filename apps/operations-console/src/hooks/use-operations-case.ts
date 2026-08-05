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
import { DripplexApiError } from '@/lib/sdk-admin';

/** DPX-OPS-001 Slice 2 — a single work-queue case. `useUpdateCase`/
 * `useAddCaseNote` invalidate all three queue lists on success (not just
 * the one this case belongs to) — cheap given queue sizes, and simpler
 * than threading `caseType` through every call site to invalidate
 * precisely. */
function caseKey(caseId: string): readonly ['operations-case', string] {
  return ['operations-case', caseId] as const;
}

/** DPX-OPS-001 module-closure audit (2026-08-05) — true when `error` is the
 * 409 `OperationsCasesService.updateCase()` throws for a stale `version`
 * (see that method's own doc comment). Callers use this to distinguish
 * "someone else's newer change already landed, refresh" from an ordinary
 * failure — the two need different UI treatment, not the same generic
 * "couldn't save, try again" toast. */
export function isCaseVersionConflict(error: unknown): boolean {
  return error instanceof DripplexApiError && error.statusCode === 409;
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
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.sosPrefix });
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.incidentsPrefix });
      void queryClient.invalidateQueries({ queryKey: operationsQueueKeys.supportPrefix });
    },
    onError: (error) => {
      // Someone else's update already landed with a newer version — refetch
      // so the next attempt (and the screen the operator is looking at)
      // reflects it, rather than leaving the UI showing the stale case the
      // rejected write was based on.
      if (isCaseVersionConflict(error)) {
        void queryClient.invalidateQueries({ queryKey: caseKey(caseId) });
      }
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
