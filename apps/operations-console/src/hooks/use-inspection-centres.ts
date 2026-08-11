'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateInspectionCentreRequest,
  InspectionCentreDto,
  UpdateInspectionCentreRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const centreKeys = {
  all: ['admin-inspection-centres'] as const,
};

/** DPX-DRIVER-002 Phase 3 — inspection-centre roster for the Ops Console. */
export function useInspectionCentres(): UseQueryResult<InspectionCentreDto[]> {
  return useQuery({
    queryKey: centreKeys.all,
    queryFn: () => sdk.adminInspectionCentres.list(),
    refetchInterval: 30_000,
  });
}

function useCentreMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<InspectionCentreDto>,
): UseMutationResult<InspectionCentreDto, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: centreKeys.all });
    },
  });
}

export function useCreateInspectionCentre(): UseMutationResult<
  InspectionCentreDto,
  Error,
  CreateInspectionCentreRequest
> {
  return useCentreMutation((body: CreateInspectionCentreRequest) =>
    sdk.adminInspectionCentres.create(body),
  );
}

export function useUpdateInspectionCentre(): UseMutationResult<
  InspectionCentreDto,
  Error,
  { id: string; body: UpdateInspectionCentreRequest }
> {
  return useCentreMutation(({ id, body }: { id: string; body: UpdateInspectionCentreRequest }) =>
    sdk.adminInspectionCentres.update(id, body),
  );
}
