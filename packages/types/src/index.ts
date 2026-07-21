export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from './api/response.js';
export { isApiErrorResponse, isApiSuccessResponse } from './api/response.js';

export type {
  AuthenticatedUser,
  AuthAuditAction,
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  ChangePasswordResponse,
  EmailVerificationResponse,
  ForgotPasswordResponse,
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
  ResetPasswordResponse,
  UserStatus,
  VerificationSubmittedResponse,
} from './auth/index.js';

export { AUTH_AUDIT_ACTIONS } from './auth/index.js';

export type { PaginatedResult, UserSummary } from './user/index.js';

export {
  changePasswordSchema,
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
  sendOtpSchema,
  sendVerificationSchema,
  verifyEmailSchema,
  verifyEmailTokenSchema,
  verifyOtpSchema,
  verifyPhoneOtpSchema,
  verifyPhoneSchema,
} from './validation/auth.js';

export type {
  ChangePasswordFormValues,
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
  SendOtpDto,
  SendVerificationDto,
  VerifyEmailDto,
  VerifyEmailValues,
  VerifyOtpDto,
  VerifyOtpFormValues,
  VerifyPhoneValues,
} from './validation/auth.js';
