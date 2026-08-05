'use client';

import { useQuery } from '@tanstack/react-query';

import type { OperationsStaffMemberDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-OPS-001 Slice 2 — the assignable-operator/supervisor pool for the
 * "Assign operator" control. Doesn't change often, so no polling — a
 * manual refresh (page reload) picks up newly-permissioned staff. */
export function useAssignableStaff(): UseQueryResult<OperationsStaffMemberDto[]> {
  return useQuery({
    queryKey: ['operations-staff'],
    queryFn: () => sdk.operationsStaff.list(),
  });
}
