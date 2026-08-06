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

export interface RegistrationRepository {
  registerPortalUser(input: PortalRegistrationInput): Promise<PortalRegistrationResult>;
}

export const REGISTRATION_REPOSITORY = Symbol('REGISTRATION_REPOSITORY');
