'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateDriverSupportTicketRequest, DriverSupportTicketDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 3 — Driver Support. */
const supportKeys = {
  all: ['driver-support-tickets'] as const,
};

export function useSupportTickets(): UseQueryResult<DriverSupportTicketDto[]> {
  return useQuery({
    queryKey: supportKeys.all,
    queryFn: () => sdk.support.listOwn(),
  });
}

export function useCreateSupportTicket(): UseMutationResult<
  DriverSupportTicketDto,
  Error,
  CreateDriverSupportTicketRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDriverSupportTicketRequest) => sdk.support.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
}
