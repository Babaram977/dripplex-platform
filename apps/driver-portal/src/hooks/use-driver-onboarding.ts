'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DriverOnboardingDto, SubmitEmergencyContactRequest } from '@dripplex/types';
import type { UseMutationResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/** DPX-DRIVER-002 Phase 1's emergency-contact endpoint was always freely
 * re-callable post-onboarding (see OnboardingService.submitEmergencyContact)
 * — this just wires it into a driver-portal hook so the profile page can
 * offer an edit form, not just the original one-time onboarding step. */
export function useSubmitEmergencyContact(): UseMutationResult<
  DriverOnboardingDto,
  Error,
  SubmitEmergencyContactRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitEmergencyContactRequest) =>
      sdk.onboarding.submitEmergencyContact(body),
    onSuccess: () => {
      // Emergency contact is also surfaced on DriverProfileDto — keep the
      // profile query in sync so the edit form reflects the saved value.
      void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
    },
  });
}
