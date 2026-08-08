'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AcceptDriverAgreementRequest,
  DriverActivationEligibilityDto,
  DriverOnboardingDto,
  SubmitEmergencyContactRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

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
      void queryClient.invalidateQueries({ queryKey: ['driver-activation-eligibility'] });
    },
  });
}

/** DPX-DRIVER-007 — accept the Driver Agreement (POST /driver/onboarding/agreement).
 * Previously unused by the portal; wired here for the Registration Completion flow. */
export function useAcceptAgreement(): UseMutationResult<
  DriverOnboardingDto,
  Error,
  AcceptDriverAgreementRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptDriverAgreementRequest) => sdk.onboarding.acceptAgreement(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['driver-activation-eligibility'] });
    },
  });
}

/** DPX-DRIVER-007 — submit onboarding for review (POST /driver/onboarding/submit).
 * This is the real DRAFT → SUBMITTED transition the Figma "Submit for Review"
 * CTA maps to. Previously unused by the portal. */
export function useSubmitOnboarding(): UseMutationResult<DriverOnboardingDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.onboarding.submit(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['driver-activation-eligibility'] });
    },
  });
}

/** DPX-DRIVER-007 — the unified activation gate (GET /driver/activation-eligibility),
 * used to drive the "what's blocking submission" checklist and gate the Submit button. */
export function useActivationEligibility(): UseQueryResult<DriverActivationEligibilityDto> {
  return useQuery({
    queryKey: ['driver-activation-eligibility'],
    queryFn: () => sdk.profile.getActivationEligibility(),
  });
}

/** DPX-DRIVER-007 — driver-facing onboarding state (GET /driver/onboarding). */
export function useDriverOnboarding(): UseQueryResult<DriverOnboardingDto> {
  return useQuery({
    queryKey: ['driver-onboarding'],
    queryFn: () => sdk.onboarding.getOwn(),
  });
}
