'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateIncidentReportRequest, IncidentReportDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** Driver Slice 2 item 4 — Incident Reporting. */
const incidentReportKeys = {
  all: ['driver-incident-reports'] as const,
};

export function useIncidentReports(): UseQueryResult<IncidentReportDto[]> {
  return useQuery({
    queryKey: incidentReportKeys.all,
    queryFn: () => sdk.incidentReports.listOwn(),
  });
}

export function useCreateIncidentReport(): UseMutationResult<
  IncidentReportDto,
  Error,
  CreateIncidentReportRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIncidentReportRequest) => sdk.incidentReports.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incidentReportKeys.all });
    },
  });
}
