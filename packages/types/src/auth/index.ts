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

export type PortalLoginType = 'customer' | 'merchant' | 'rider' | 'driver';

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

export interface LoginSessionMetadata {
  id: string;
  portal: PortalLoginType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface PortalLoginResponse {
  user: AuthUserProfile;
  session: LoginSessionMetadata;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

export interface AuthenticatedUser {
  id: string;
  sid: string;
  email: string;
  role: string;
  portal: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  portal: string;
  typ: 'access' | 'refresh';
  iat?: number;
  exp?: number;
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
  LOGIN_STARTED: 'auth.login.started',
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  SESSION_CREATED: 'auth.session.created',
  REFRESH_STARTED: 'auth.refresh.started',
  REFRESH_SUCCESS: 'auth.refresh.success',
  REFRESH_FAILED: 'auth.refresh.failed',
  REFRESH_REUSED: 'auth.refresh.reused',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout.all',
  SESSION_REVOKED: 'auth.session.revoked',
  PASSWORD_FORGOT: 'auth.password.forgot',
  PASSWORD_RESET_STARTED: 'auth.password.reset.started',
  PASSWORD_RESET_SUCCESS: 'auth.password.reset.success',
  PASSWORD_RESET_FAILED: 'auth.password.reset.failed',
  PASSWORD_CHANGED: 'auth.password.changed',
  PASSWORD_CHANGE_FAILED: 'auth.password.change.failed',
  SESSIONS_REVOKED_PASSWORD: 'auth.sessions.revoked.password',
  EMAIL_SENT: 'auth.email.sent',
  EMAIL_VERIFIED: 'auth.email.verified',
  EMAIL_VERIFICATION_FAILED: 'auth.email.failed',
  PHONE_OTP_SENT: 'auth.phone.otp.sent',
  PHONE_VERIFIED: 'auth.phone.verified',
  PHONE_VERIFICATION_FAILED: 'auth.phone.failed',
  VERIFICATION_EXPIRED: 'auth.verification.expired',
} as const;

export type AuthAuditAction = (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];

export interface ForgotPasswordResponse {
  submitted: true;
}

export interface ResetPasswordResponse {
  reset: true;
}

export interface ChangePasswordResponse {
  changed: true;
}

export interface VerificationSubmittedResponse {
  submitted: true;
}
