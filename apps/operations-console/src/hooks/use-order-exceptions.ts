'use client';

import { useQuery } from '@tanstack/react-query';

import type { OrderExceptionDto, PaginatedResult } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * DPX-ORDER-8D-C ops visibility — the stalled-order exception queue.
 *
 * Mirrors `AdminListOrderExceptionsQuery` structurally rather than importing
 * it, the same way `QueueFilters` mirrors `OperationsQueueQuery`: the SDK method
 * only needs an object of this shape.
 */
export interface OrderExceptionFilters {
  status?: 'OPEN' | 'RESOLVED';
  type?: 'STALLED_CONFIRMED';
  page?: number;
  pageSize?: number;
}

const ORDER_EXCEPTIONS_PREFIX = ['operations-order-exceptions'] as const;

export const orderExceptionKeys = {
  list: (filters: OrderExceptionFilters = {}) => [...ORDER_EXCEPTIONS_PREFIX, filters] as const,
  prefix: ORDER_EXCEPTIONS_PREFIX,
};

/**
 * Polls on the same 15s cadence as the other work queues — this is a "who needs
 * help right now" screen, not a background summary.
 *
 * Worth knowing when reading the numbers: the backend sweep that RAISES these
 * runs every 15 minutes against a 30-minute threshold, so a newly stalled order
 * appears here within a sweep, not within a poll. Polling faster would not
 * surface anything sooner; it keeps an already-open queue current as orders are
 * worked and exceptions resolve.
 */
export function useOrderExceptions(
  filters: OrderExceptionFilters = {},
): UseQueryResult<PaginatedResult<OrderExceptionDto>> {
  return useQuery({
    queryKey: orderExceptionKeys.list(filters),
    queryFn: () => sdk.orders.adminGetOrderExceptions(filters),
    refetchInterval: 15_000,
  });
}
