'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { riderDeliveryKeys } from './query-keys';

import type { ConfirmCashDto, DeliverOrderDto, DeliveryJobDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * Every rider lifecycle action returns the updated DeliveryJobDto. The job
 * list is refetched on success so the card re-renders with the state the
 * backend actually moved the job into (the state machine is the authority).
 */
function useJobRefetch(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: riderDeliveryKeys.jobs() }).then(() => undefined);
}

/** POST /rider/jobs/:id/accept — ASSIGNED → ACCEPTED. */
export function useAcceptJob(): UseMutationResult<DeliveryJobDto, Error, string> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: (jobId: string) => sdk.riderDelivery.accept(jobId),
    onSuccess: () => refetch(),
  });
}

/** POST /rider/jobs/:id/reject — ASSIGNED → cleared (job re-enters assignment). */
export function useRejectJob(): UseMutationResult<DeliveryJobDto, Error, string> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: (jobId: string) => sdk.riderDelivery.reject(jobId),
    onSuccess: () => refetch(),
  });
}

/** POST /rider/jobs/:id/pickup — ACCEPTED → PICKED_UP. */
export function usePickUpJob(): UseMutationResult<DeliveryJobDto, Error, string> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: (jobId: string) => sdk.riderDelivery.pickUp(jobId),
    onSuccess: () => refetch(),
  });
}

/** POST /rider/jobs/:id/arrived — PICKED_UP | ON_THE_WAY → ARRIVED. */
export function useArrivedJob(): UseMutationResult<DeliveryJobDto, Error, string> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: (jobId: string) => sdk.riderDelivery.arrived(jobId),
    onSuccess: () => refetch(),
  });
}

export interface DeliverVariables {
  jobId: string;
  body: DeliverOrderDto;
}

/** POST /rider/jobs/:id/deliver — ARRIVED → DELIVERED (records proof). */
export function useDeliverJob(): UseMutationResult<DeliveryJobDto, Error, DeliverVariables> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: ({ jobId, body }: DeliverVariables) => sdk.riderDelivery.deliver(jobId, body),
    onSuccess: () => refetch(),
  });
}

export interface ConfirmCashVariables {
  jobId: string;
  body: ConfirmCashDto;
}

/**
 * POST /rider/jobs/:id/confirm-cash — DELIVERED job, cash-on-delivery only.
 * Idempotent server-side. The backend rejects non-cash orders; DeliveryJobDto
 * does not expose the order payment method, so this action is offered on any
 * un-confirmed DELIVERED job and surfaces the backend error if it is not cash.
 */
export function useConfirmCash(): UseMutationResult<DeliveryJobDto, Error, ConfirmCashVariables> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: ({ jobId, body }: ConfirmCashVariables) =>
      sdk.riderDelivery.confirmCash(jobId, body),
    onSuccess: () => refetch(),
  });
}

export interface ReasonVariables {
  jobId: string;
  reason?: string;
}

/** POST /rider/jobs/:id/fail — any active status → FAILED. */
export function useFailJob(): UseMutationResult<DeliveryJobDto, Error, ReasonVariables> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: ({ jobId, reason }: ReasonVariables) =>
      sdk.riderDelivery.fail(jobId, reason !== undefined ? { reason } : {}),
    onSuccess: () => refetch(),
  });
}

/** POST /rider/jobs/:id/return — PICKED_UP | ON_THE_WAY | ARRIVED → RETURNED. */
export function useReturnJob(): UseMutationResult<DeliveryJobDto, Error, ReasonVariables> {
  const refetch = useJobRefetch();
  return useMutation({
    mutationFn: ({ jobId, reason }: ReasonVariables) =>
      sdk.riderDelivery.returnJob(jobId, reason !== undefined ? { reason } : {}),
    onSuccess: () => refetch(),
  });
}
