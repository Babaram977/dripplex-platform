'use client';

import { useMutation } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { ReportRideProblemRequest, RideProblemReportDto } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

interface ReportRideProblemVariables {
  rideId: string;
  body: ReportRideProblemRequest;
}

/**
 * Text-only — ReportRideProblemDto has category + description, no photo
 * field. See docs/RIDE-003-INTEGRATION-MAP.md section 6, gap #9.
 */
export function useReportRideProblem(): UseMutationResult<
  RideProblemReportDto,
  Error,
  ReportRideProblemVariables
> {
  return useMutation({
    mutationFn: ({ rideId, body }: ReportRideProblemVariables) =>
      sdk.rides.reportProblem(rideId, body),
  });
}
