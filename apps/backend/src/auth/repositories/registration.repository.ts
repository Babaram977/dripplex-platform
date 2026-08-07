import type { RegistrationChannel, UserStatus } from '@prisma/client';

export interface PortalRegistrationInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
  registrationChannel: RegistrationChannel;
  roleName: string;
  portal: 'customer' | 'merchant' | 'rider' | 'driver';
  /** Set for identity-provider signups (e.g. Google) that arrive with an
   * already-verified email — skips the usual email-OTP verification step. */
  emailVerifiedAt?: Date;
  /** Set for Google-originated signups. */
  googleId?: string;
}

export interface PortalRegistrationResult {
  userId: string;
  email: string;
  status: UserStatus;
  profileId?: string;
  onboardingId?: string;
}

/** Grants an additional role -- and its domain profile + onboarding record
 * -- to an ALREADY-EXISTING user. Distinct from `registerPortalUser`, which
 * always creates a brand-new user. Only 'merchant' and 'driver' carry a
 * profile+onboarding pair today; 'rider' would follow the same shape if
 * ever needed here. */
export interface AddPortalRoleInput {
  userId: string;
  roleName: string;
  portal: 'merchant' | 'driver';
}

export interface AddPortalRoleResult {
  profileId: string;
  onboardingId: string;
}

export interface RegistrationRepository {
  registerPortalUser(input: PortalRegistrationInput): Promise<PortalRegistrationResult>;
  /** Throws `ConflictDomainException` if the user already holds the role. */
  addPortalRole(input: AddPortalRoleInput): Promise<AddPortalRoleResult>;
}

export const REGISTRATION_REPOSITORY = Symbol('REGISTRATION_REPOSITORY');
