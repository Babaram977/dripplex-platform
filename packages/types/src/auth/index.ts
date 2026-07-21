export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'BLOCKED';

export type RegistrationChannel =
  | 'CUSTOMER_WEB'
  | 'MERCHANT_PORTAL'
  | 'RIDER_PORTAL'
  | 'DRIVER_PORTAL'
  | 'OPS_INVITE'
  | 'ADMIN_INVITE'
  | 'SEED';

export type OtpPurpose =
  'email_verification' | 'phone_verification' | 'password_reset' | 'login_step_up';

export type OnboardingStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export type PortalRegistrationType = 'customer' | 'merchant' | 'rider' | 'driver';

export interface RegistrationVerificationInfo {
  emailOtpSent: boolean;
  phoneOtpSent: boolean;
  expiresInSeconds: number;
}

export interface RegistrationResponse {
  userId: string;
  email: string;
  status: UserStatus;
  verification: RegistrationVerificationInfo;
  profileId?: string;
  onboardingId?: string;
}

export interface EmailVerificationResponse {
  verified: true;
  email: string;
  status: UserStatus;
  emailVerifiedAt: string;
}

export interface PhoneVerificationResponse {
  verified: true;
  phone: string;
  status: UserStatus;
  phoneVerifiedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  typ: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles: string[];
  permissions: string[];
}

export interface AuthSessionPayload {
  user: AuthUserProfile;
  tokens: AuthTokens;
}

export const AUTH_AUDIT_ACTIONS = {
  REGISTRATION_COMPLETED: 'auth.registration.completed',
  OTP_SENT: 'auth.otp.sent',
  OTP_VERIFIED: 'auth.otp.verified',
  OTP_FAILED: 'auth.otp.failed',
} as const;

export type AuthAuditAction = (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];
