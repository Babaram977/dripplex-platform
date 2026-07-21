export const AUTH_AUDIT_ACTIONS = {
  REGISTRATION_COMPLETED: 'auth.registration.completed',
  OTP_SENT: 'auth.otp.sent',
  OTP_VERIFIED: 'auth.otp.verified',
  OTP_FAILED: 'auth.otp.failed',
  LOGIN_STARTED: 'auth.login.started',
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  SESSION_CREATED: 'auth.session.created',
} as const;
