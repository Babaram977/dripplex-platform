export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from './api/response.js';
export { isApiErrorResponse, isApiSuccessResponse } from './api/response.js';

export type {
  AuthenticatedUser,
  AuthAuditAction,
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  EmailVerificationResponse,
  JwtPayload,
  LoginSessionMetadata,
  OnboardingStatus,
  OtpPurpose,
  PhoneVerificationResponse,
  PortalLoginResponse,
  PortalLoginType,
  PortalRegistrationType,
  RegistrationChannel,
  RegistrationResponse,
  RegistrationVerificationInfo,
  UserStatus,
} from './auth/index.js';

export { AUTH_AUDIT_ACTIONS } from './auth/index.js';

export type { PaginatedResult, UserSummary } from './user/index.js';

export {
  contactSchema,
  customerRegistrationSchema,
  driverRegistrationSchema,
  forgotPasswordSchema,
  loginSchema,
  merchantRegistrationSchema,
  portalLoginSchema,
  registerSchema,
  resetPasswordSchema,
  riderRegistrationSchema,
  verifyEmailSchema,
  verifyOtpSchema,
  verifyPhoneSchema,
} from './validation/auth.js';

export type {
  ContactFormValues,
  CustomerRegistrationValues,
  DriverRegistrationValues,
  ForgotPasswordFormValues,
  LoginFormValues,
  MerchantRegistrationValues,
  PortalLoginValues,
  RegisterFormValues,
  ResetPasswordFormValues,
  RiderRegistrationValues,
  VerifyEmailValues,
  VerifyOtpFormValues,
  VerifyPhoneValues,
} from './validation/auth.js';
