export type OtpPurpose =
  'email_verification' | 'phone_verification' | 'password_reset' | 'login_step_up';

export type PortalRegistrationType = 'customer' | 'merchant' | 'rider' | 'driver';

export interface RegistrationVerificationInfo {
  emailOtpSent: boolean;
  phoneOtpSent: boolean;
  expiresInSeconds: number;
}

export interface RegistrationResponse {
  userId: string;
  email: string;
  status: string;
  verification: RegistrationVerificationInfo;
  profileId?: string;
  onboardingId?: string;
}

export interface EmailVerificationResponse {
  verified: true;
  email: string;
  status: string;
  emailVerifiedAt: string;
}

export interface PhoneVerificationResponse {
  verified: true;
  phone: string;
  status: string;
  phoneVerifiedAt: string;
}
