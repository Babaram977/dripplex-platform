import type { DriverOnboardingDto } from '@dripplex/types';
import type { DriverOnboarding } from '@prisma/client';

export function toDriverOnboardingDto(
  onboarding: DriverOnboarding,
  driverId: string,
): DriverOnboardingDto {
  return {
    id: onboarding.id,
    driverId,
    status: onboarding.status,
    createdAt: onboarding.createdAt.toISOString(),
    updatedAt: onboarding.updatedAt.toISOString(),
  };
}
