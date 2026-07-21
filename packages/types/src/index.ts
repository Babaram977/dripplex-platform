export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from './api/response.js';
export { isApiErrorResponse, isApiSuccessResponse } from './api/response.js';

export type {
  AuthenticatedUser,
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  JwtPayload,
  UserStatus,
} from './auth/index.js';

export type { PaginatedResult, UserSummary } from './user/index.js';

export {
  contactSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './validation/auth.js';

export type {
  ContactFormValues,
  ForgotPasswordFormValues,
  LoginFormValues,
  RegisterFormValues,
  ResetPasswordFormValues,
  VerifyOtpFormValues,
} from './validation/auth.js';
