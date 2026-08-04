'use client';

import { useQuery } from '@tanstack/react-query';

import type { InspectionDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 9 — read-only inspection history for the profile
 * page. Scheduling a new inspection (centre picker + date/time) is a
 * larger surface the founder's field-level decision didn't ask for
 * ("inspection history" — viewable, not "book inspection") — left as a
 * documented gap alongside the rest of the never-wired-to-driver-portal
 * inspection booking flow. */
export function useDriverInspections(): UseQueryResult<InspectionDto[]> {
  return useQuery({
    queryKey: ['driver-inspections'],
    queryFn: () => sdk.inspections.listOwn(),
  });
}
