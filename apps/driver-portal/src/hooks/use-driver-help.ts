'use client';

import { useQuery } from '@tanstack/react-query';

import type { CmsContentDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 7 — Help Centre. Reuses the platform Cms module
 * (`CmsContentType.DRIVER_FAQ`/`DRIVER_STATIC_PAGE`) — read-only here,
 * authoring happens in the existing admin CMS. */
export function useDriverHelp(): UseQueryResult<CmsContentDto[]> {
  return useQuery({
    queryKey: ['driver-help'],
    queryFn: () => sdk.help.list(),
  });
}
