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
