import { z } from 'zod';

const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Duration must look like 15m, 7d, 3600s');

/**
 * DPX-STORAGE-001 — a value that is either empty (the safe-until-configured
 * default) or a well-formed URL. Optional object-storage endpoints use this so a
 * non-empty-but-malformed value fails fast at boot instead of throwing an opaque
 * `new URL(...)` error at the first sign request. Empty stays a valid no-op.
 */
const emptyOrUrl = z.union([z.string().url(), z.literal('')]).default('');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_GLOBAL_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: durationSchema.default('15m'),
  JWT_REFRESH_TTL: durationSchema.default('7d'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_EMAIL_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_SMS_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_HOURLY_LIMIT: z.coerce.number().int().positive().default(5),
  OTP_DAILY_LIMIT: z.coerce.number().int().positive().default(10),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  LOGIN_MAX_ATTEMPTS_PER_EMAIL: z.coerce.number().int().positive().default(10),
  LOGIN_MAX_ATTEMPTS_PER_IP: z.coerce.number().int().positive().default(30),
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  PASSWORD_RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  PASSWORD_FORGOT_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),
  OTP_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  EMAIL_VERIFICATION_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  EMAIL_VERIFICATION_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),
  PHONE_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PHONE_OTP_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),
  IDENTITY_VERIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  IDENTITY_VERIFICATION_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(1800),
  IDENTITY_VERIFICATION_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  SESSION_ACTIVITY_THROTTLE_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PAYSTACK_SECRET_KEY: z.string().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().default(''),
  PAYSTACK_BASE_URL: z.string().url().default('https://api.paystack.co'),
  FLUTTERWAVE_SECRET_KEY: z.string().default(''),
  FLUTTERWAVE_PUBLIC_KEY: z.string().default(''),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().default(''),
  FLUTTERWAVE_BASE_URL: z.string().url().default('https://api.flutterwave.com'),
  OPAY_API_KEY: z.string().default(''),
  PAYMENT_DEFAULT_PROVIDER: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY']).default('PAYSTACK'),
  // Peyflex — the utilities aggregator behind the Utilities tab
  // (DPX-UTILITIES-002). The token is a static Django REST Framework token
  // from the Peyflex dashboard and spends a prefunded DrippleX float, so it
  // belongs in a Railway environment variable and nowhere else. Empty by
  // default: the Utilities feature ships deployed-but-disabled and the
  // not-configured adapter refuses every call with a clear message, the same
  // pattern the payment providers use.
  PEYFLEX_BASE_URL: z.string().url().default('https://client.peyflex.com.ng'),
  PEYFLEX_API_TOKEN: z.string().default(''),
  // The float is shared by every utility purchase on the platform, so it
  // running dry is not one unlucky customer — it is a total outage of all
  // four services at once. Ops needs to hear about it on a threshold, not on
  // zero (DPX-UTILITIES-001 §1.2).
  PEYFLEX_FLOAT_LOW_BALANCE_THRESHOLD: z.coerce.number().nonnegative().default(50_000),
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_PRIVATE_KEY: z.string().default(''),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().default(''),
  // Google Sign-In (OAuth 2.0) — all default to '' (unconfigured). The
  // strategy/controller check googleOAuthConfigured before ever attempting
  // a real OAuth redirect, so an empty value here is a safe no-op, not a
  // boot-time crash (same pattern as Smile ID / payment providers).
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  // Exact backend callback URL to register in Google Cloud Console, e.g.
  // https://api.dripplex.com/api/v1/auth/google/callback in production.
  GOOGLE_CALLBACK_URL: z.string().default(''),
  // Where to send the browser after a Google OAuth round-trip completes.
  CUSTOMER_APP_URL: z.string().default('http://localhost:3001'),
  SMILE_ID_PARTNER_ID: z.string().default(''),
  SMILE_ID_API_KEY: z.string().default(''),
  SMILE_ID_BASE_URL: z.string().url().default('https://api.smileidentity.com/v1'),
  // Termii (SMS) and Resend (email) — production notification providers.
  // Both default to '' (unconfigured). ProductionNotificationService checks
  // termiiConfigured/resendConfigured per-channel before ever calling the
  // real API, falling back to LoggingNotificationService's log-only
  // behavior for whichever channel isn't set — same safe-until-configured
  // pattern as Google OAuth / Smile ID / payment providers above. This
  // means SMS and email can be turned on independently, at different times.
  TERMII_API_KEY: z.string().default(''),
  TERMII_SENDER_ID: z.string().default('DrippleX'),
  TERMII_BASE_URL: z.string().url().default('https://api.ng.termii.com'),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('DrippleX <no-reply@dripplex.com>'),
  // Driver-001 Security Standard: reconfirmed default 2h (was 8h), only used
  // to seed DriverSecuritySettings on first creation — see driver.constants.ts.
  IDENTITY_VERIFICATION_IDLE_HOURS: z.coerce.number().int().min(1).max(48).default(2),
  // DPX-DS-001 — driver facial-verification risk engine, extensible/configurable
  // per the founder's standard, not hard-coded.
  DRIVER_IDV_LOCKOUT_THRESHOLD: z.coerce.number().int().min(1).max(20).default(5),
  DRIVER_IDV_GPS_ANOMALY_SPEED_KMH: z.coerce.number().positive().default(150),
  DRIVER_IDV_SPOT_CHECK_DENOMINATOR: z.coerce.number().int().min(1).default(20),
  // DPX-DRIVER-016 — S3-compatible object storage (Cloudflare R2 or AWS S3) for
  // signed direct-to-storage uploads. All default to '' (unconfigured): the
  // uploads provider checks objectStorageConfigured before signing and throws a
  // clear error if unset, so an empty value is a safe no-op rather than a
  // boot-time crash — same safe-until-configured pattern as Smile ID / payments.
  //
  // DPX-STORAGE-001 (Phase 4): storage stays OPTIONAL for development, but when
  // an endpoint / public base URL IS provided it must be a well-formed URL —
  // an empty string is still accepted (the no-op default), while a malformed
  // value now fails fast at boot rather than throwing an opaque `new URL(...)`
  // error at the first sign request. Credentials/bucket remain deployment-
  // specific and are never defaulted to a real value here.
  OBJECT_STORAGE_ENDPOINT: emptyOrUrl,
  OBJECT_STORAGE_REGION: z.string().default('auto'),
  OBJECT_STORAGE_BUCKET: z.string().default(''),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().default(''),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  // Optional public/CDN base URL objects are served from; falls back to the
  // endpoint/bucket path when unset. Validated as a URL when non-empty.
  OBJECT_STORAGE_PUBLIC_BASE_URL: emptyOrUrl,
  // Separate PUBLIC-read bucket for catalog/public assets (product images).
  // Sensitive objects (KYC, identity) stay in OBJECT_STORAGE_BUCKET, which must
  // remain private. Public routing only activates when BOTH this and
  // OBJECT_STORAGE_PUBLIC_BASE_URL are set; otherwise behaviour is unchanged.
  OBJECT_STORAGE_PUBLIC_BUCKET: z.string().default(''),
  // Merchant activation flag (staged launch). The Merchant module is fully
  // built but stays deployed-but-disabled until the controlled merchant pilot:
  // when 'false' (default) every merchant-facing endpoint is rejected by
  // MerchantModuleEnabledGuard. Flip to 'true' to activate the merchant cohort.
  // Admin merchant-review/approval and customer browse are NOT gated by this.
  MERCHANT_MODULE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // Portal email activation (temporary, SMS-provider dependent). While the
  // Termii SMS sender ID is pending approval, phone OTPs can't be delivered,
  // so merchant/driver/rider self-registration would be stuck forever at
  // PENDING_VERIFICATION. When 'true', those three portals activate on EMAIL
  // verification alone (no phone OTP dispatched, phone verification not
  // required to register or log in). Customer is unaffected (already email-or-
  // phone with no phone-verification requirement). Flip back to 'false' once
  // Termii SMS is live to restore mandatory phone verification for those
  // portals. Founder-authorized 2026-08-10.
  PORTAL_EMAIL_ACTIVATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
