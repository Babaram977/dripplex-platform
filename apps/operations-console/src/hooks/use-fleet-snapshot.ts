'use client';

import { useQuery } from '@tanstack/react-query';

import type { OperationsFleetSnapshotDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 1 — Live Fleet Map + driver list. Polls every 15s: the
 * founder's framing is "the air traffic control screen for DrippleX," and
 * an operator watching this screen needs SOS/status changes to show up
 * without a manual refresh. Faster than driver-portal's 60s shift-summary
 * poll because this is a live operational surface, not a personal status
 * check. */
export function useFleetSnapshot(): UseQueryResult<OperationsFleetSnapshotDto> {
  return useQuery({
    queryKey: ['operations-fleet-snapshot'],
    queryFn: () => sdk.operationsFleet.getSnapshot(),
    refetchInterval: 15_000,
  });
}
