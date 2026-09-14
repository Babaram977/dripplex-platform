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
  SESSION_LIST: 'auth.session.list',
  SESSIONS_REVOKED_ALL: 'auth.sessions.revoked_all',
  SESSION_ACTIVITY: 'auth.session.activity',
  GOOGLE_LOGIN_STARTED: 'auth.google.login.started',
  GOOGLE_LOGIN_SUCCESS: 'auth.google.login.success',
  GOOGLE_LOGIN_FAILED: 'auth.google.login.failed',
  GOOGLE_ACCOUNT_LINKED: 'auth.google.account.linked',
  GOOGLE_ACCOUNT_CREATED: 'auth.google.account.created',
  PROFILE_UPDATED: 'profile.updated',
  PROFILE_PHONE_CHANGE_REQUESTED: 'profile.phone_change_requested',
  PROFILE_PHONE_CHANGED: 'profile.phone_changed',
  PROFILE_PHONE_CHANGE_FAILED: 'profile.phone_change_failed',
  PROFILE_EMAIL_CHANGE_REQUESTED: 'profile.email_change_requested',
  PROFILE_EMAIL_CHANGED: 'profile.email_changed',
  PROFILE_EMAIL_CHANGE_FAILED: 'profile.email_change_failed',
} as const;

export { MERCHANT_AUDIT_ACTIONS } from '../merchants/merchant.constants';
export { ADDRESS_AUDIT_ACTIONS } from '../addresses/address.constants';
export { CART_AUDIT_ACTIONS } from '../cart/cart.constants';
export { KYC_AUDIT_ACTIONS } from '../kyc/kyc.constants';

/**
 * P1-B2 — the single audit stream.
 *
 * One row, one id. The stream is global rather than per-tenant or per-module
 * because a sequence that is only unique within a partition cannot answer
 * "what happened next" across the platform, which is the question an audit is
 * for.
 */
export const STREAM_STATE_ID = 'main';

/**
 * The chain's genesis anchor: 64 zeroes.
 *
 * Used as the predecessor of the very first event, and as the placeholder
 * first/last hash of a segment that has not yet received one. It is not a real
 * digest and nothing should verify against it — a segment still carrying it
 * has no events, which its eventCount says plainly.
 */
export const GENESIS_HASH = '0'.repeat(64);

/** The fixed id of the first segment, so genesis is identifiable in any
 *  environment without a lookup. */
export const GENESIS_SEGMENT_ID = '00000000-0000-0000-0000-000000000001';
