'use client';

import { useQuery } from '@tanstack/react-query';

import type { OrderRecoveryActivationStateDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const RECOVERY_ACTIVATION_PREFIX = ['operations-recovery-activation-state'] as const;

export const recoveryActivationStateKeys = {
  state: () => [...RECOVERY_ACTIVATION_PREFIX] as const,
  prefix: RECOVERY_ACTIVATION_PREFIX,
};

/**
 * DPX-ORDER-8D-RECOVERY — is the 24-hour automatic backstop armed?
 *
 * WHY THIS EXISTS AS A SCREEN. The state was only ever announced in the
 * backend's startup logs, and Railway's per-replica log limit discarded that
 * line on three of four production deploys (310, 411 and 433 messages dropped).
 * An operator asked to confirm the platform is not about to cancel orders and
 * move money by itself had nothing dependable to look at. #426 made the log
 * survivable; this makes the answer askable.
 *
 * NOT CACHED ACROSS RELOADS, and `retry: false`. A stale or inferred answer to
 * "can the platform move money right now" is worse than no answer: the screen
 * must show what the backend says now, or show that it could not ask.
 */
export function useRecoveryActivationState(): UseQueryResult<OrderRecoveryActivationStateDto> {
  return useQuery({
    queryKey: recoveryActivationStateKeys.state(),
    queryFn: () => sdk.orders.adminGetOrderRecoveryActivationState(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
