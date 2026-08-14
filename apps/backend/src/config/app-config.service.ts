import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvConfig } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  public get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  public get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  public get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  public get redisUrl(): string {
    return this.configService.get('REDIS_URL', { infer: true });
  }

  public get apiHost(): string {
    return this.configService.get('API_HOST', { infer: true });
  }

  public get apiPort(): number {
    return this.configService.get('API_PORT', { infer: true });
  }

  public get apiGlobalPrefix(): string {
    return this.configService.get('API_GLOBAL_PREFIX', { infer: true });
  }

  public get corsOrigins(): string[] {
    return this.configService
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  public get jwtAccessSecret(): string {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  public get jwtRefreshSecret(): string {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  public get jwtAccessTtl(): string {
    return this.configService.get('JWT_ACCESS_TTL', { infer: true });
  }

  public get jwtRefreshTtl(): string {
    return this.configService.get('JWT_REFRESH_TTL', { infer: true });
  }

  public get otpTtlSeconds(): number {
    return this.configService.get('OTP_TTL_SECONDS', { infer: true });
  }

  public get otpEmailTtlSeconds(): number {
    return this.configService.get('OTP_EMAIL_TTL_SECONDS', { infer: true });
  }

  public get otpSmsTtlSeconds(): number {
    return this.configService.get('OTP_SMS_TTL_SECONDS', { infer: true });
  }

  public get otpMaxVerifyAttempts(): number {
    return this.configService.get('OTP_MAX_VERIFY_ATTEMPTS', { infer: true });
  }

  public get otpLockoutSeconds(): number {
    return this.configService.get('OTP_LOCKOUT_SECONDS', { infer: true });
  }

  public get otpResendCooldownSeconds(): number {
    return this.configService.get('OTP_RESEND_COOLDOWN_SECONDS', { infer: true });
  }

  public get otpHourlyLimit(): number {
    return this.configService.get('OTP_HOURLY_LIMIT', { infer: true });
  }

  public get otpDailyLimit(): number {
    return this.configService.get('OTP_DAILY_LIMIT', { infer: true });
  }

  public get otpLength(): number {
    return this.configService.get('OTP_LENGTH', { infer: true });
  }

  public get bcryptSaltRounds(): number {
    return this.configService.get('BCRYPT_SALT_ROUNDS', { infer: true });
  }

  public get throttleTtlMs(): number {
    return this.configService.get('THROTTLE_TTL_MS', { infer: true });
  }

  public get throttleLimit(): number {
    return this.configService.get('THROTTLE_LIMIT', { infer: true });
  }

  public get sessionTtlSeconds(): number {
    return this.configService.get('SESSION_TTL_SECONDS', { infer: true });
  }

  public get loginMaxAttemptsPerEmail(): number {
    return this.configService.get('LOGIN_MAX_ATTEMPTS_PER_EMAIL', { infer: true });
  }

  public get loginMaxAttemptsPerIp(): number {
    return this.configService.get('LOGIN_MAX_ATTEMPTS_PER_IP', { infer: true });
  }

  public get loginLockoutSeconds(): number {
    return this.configService.get('LOGIN_LOCKOUT_SECONDS', { infer: true });
  }

  public get passwordResetTokenTtlSeconds(): number {
    return this.configService.get('PASSWORD_RESET_TOKEN_TTL_SECONDS', { infer: true });
  }

  public get passwordForgotMaxPerHour(): number {
    return this.configService.get('PASSWORD_FORGOT_MAX_PER_HOUR', { infer: true });
  }

  public get otpResetTtlSeconds(): number {
    return this.configService.get('OTP_RESET_TTL_SECONDS', { infer: true });
  }

  public get emailVerificationTtlSeconds(): number {
    return this.configService.get('EMAIL_VERIFICATION_TTL_SECONDS', { infer: true });
  }

  public get emailVerificationMaxPerHour(): number {
    return this.configService.get('EMAIL_VERIFICATION_MAX_PER_HOUR', { infer: true });
  }

  public get phoneOtpTtlSeconds(): number {
    return this.configService.get('PHONE_OTP_TTL_SECONDS', { infer: true });
  }

  public get phoneOtpMaxPerHour(): number {
    return this.configService.get('PHONE_OTP_MAX_PER_HOUR', { infer: true });
  }

  public get identityVerificationMaxAttempts(): number {
    return this.configService.get('IDENTITY_VERIFICATION_MAX_ATTEMPTS', { infer: true });
  }

  public get identityVerificationLockoutSeconds(): number {
    return this.configService.get('IDENTITY_VERIFICATION_LOCKOUT_SECONDS', { infer: true });
  }

  public get identityVerificationResendCooldownSeconds(): number {
    return this.configService.get('IDENTITY_VERIFICATION_RESEND_COOLDOWN_SECONDS', { infer: true });
  }

  public get sessionActivityThrottleSeconds(): number {
    return this.configService.get('SESSION_ACTIVITY_THROTTLE_SECONDS', { infer: true });
  }

  public get logLevel(): EnvConfig['LOG_LEVEL'] {
    return this.configService.get('LOG_LEVEL', { infer: true });
  }

  public get paystackSecretKey(): string {
    return this.configService.get('PAYSTACK_SECRET_KEY', { infer: true });
  }

  public get paystackPublicKey(): string {
    return this.configService.get('PAYSTACK_PUBLIC_KEY', { infer: true });
  }

  public get paystackBaseUrl(): string {
    return this.configService.get('PAYSTACK_BASE_URL', { infer: true });
  }

  public get flutterwaveSecretKey(): string {
    return this.configService.get('FLUTTERWAVE_SECRET_KEY', { infer: true });
  }

  public get flutterwavePublicKey(): string {
    return this.configService.get('FLUTTERWAVE_PUBLIC_KEY', { infer: true });
  }

  public get flutterwaveWebhookHash(): string {
    return this.configService.get('FLUTTERWAVE_WEBHOOK_HASH', { infer: true });
  }

  public get flutterwaveBaseUrl(): string {
    return this.configService.get('FLUTTERWAVE_BASE_URL', { infer: true });
  }

  public get opayApiKey(): string {
    return this.configService.get('OPAY_API_KEY', { infer: true });
  }

  public get paymentDefaultProvider(): EnvConfig['PAYMENT_DEFAULT_PROVIDER'] {
    return this.configService.get('PAYMENT_DEFAULT_PROVIDER', { infer: true });
  }

  public get firebaseProjectId(): string {
    return this.configService.get('FIREBASE_PROJECT_ID', { infer: true });
  }

  public get firebaseClientEmail(): string {
    return this.configService.get('FIREBASE_CLIENT_EMAIL', { infer: true });
  }

  public get firebasePrivateKey(): string {
    return this.configService.get('FIREBASE_PRIVATE_KEY', { infer: true });
  }

  public get firebaseConfigured(): boolean {
    return (
      this.firebaseProjectId !== '' &&
      this.firebaseClientEmail !== '' &&
      this.firebasePrivateKey !== ''
    );
  }

  public get googleMapsServerApiKey(): string {
    return this.configService.get('GOOGLE_MAPS_SERVER_API_KEY', { infer: true });
  }

  public get googleMapsConfigured(): boolean {
    return this.googleMapsServerApiKey !== '';
  }

  public get googleClientId(): string {
    return this.configService.get('GOOGLE_CLIENT_ID', { infer: true });
  }

  public get googleClientSecret(): string {
    return this.configService.get('GOOGLE_CLIENT_SECRET', { infer: true });
  }

  public get googleCallbackUrl(): string {
    return this.configService.get('GOOGLE_CALLBACK_URL', { infer: true });
  }

  public get googleOAuthConfigured(): boolean {
    return (
      this.googleClientId !== '' && this.googleClientSecret !== '' && this.googleCallbackUrl !== ''
    );
  }

  public get customerAppUrl(): string {
    return this.configService.get('CUSTOMER_APP_URL', { infer: true });
  }

  public get smileIdPartnerId(): string {
    return this.configService.get('SMILE_ID_PARTNER_ID', { infer: true });
  }

  public get smileIdApiKey(): string {
    return this.configService.get('SMILE_ID_API_KEY', { infer: true });
  }

  public get smileIdBaseUrl(): string {
    return this.configService.get('SMILE_ID_BASE_URL', { infer: true });
  }

  public get smileIdConfigured(): boolean {
    return this.smileIdPartnerId !== '' && this.smileIdApiKey !== '';
  }

  public get identityVerificationIdleHours(): number {
    return this.configService.get('IDENTITY_VERIFICATION_IDLE_HOURS', { infer: true });
  }

  public get driverIdvLockoutThreshold(): number {
    return this.configService.get('DRIVER_IDV_LOCKOUT_THRESHOLD', { infer: true });
  }

  public get driverIdvGpsAnomalySpeedKmh(): number {
    return this.configService.get('DRIVER_IDV_GPS_ANOMALY_SPEED_KMH', { infer: true });
  }

  public get driverIdvSpotCheckDenominator(): number {
    return this.configService.get('DRIVER_IDV_SPOT_CHECK_DENOMINATOR', { infer: true });
  }

  public get termiiApiKey(): string {
    return this.configService.get('TERMII_API_KEY', { infer: true });
  }

  public get termiiSenderId(): string {
    return this.configService.get('TERMII_SENDER_ID', { infer: true });
  }

  public get termiiBaseUrl(): string {
    return this.configService.get('TERMII_BASE_URL', { infer: true });
  }

  public get termiiConfigured(): boolean {
    return this.termiiApiKey !== '';
  }

  public get resendApiKey(): string {
    return this.configService.get('RESEND_API_KEY', { infer: true });
  }

  public get resendFromEmail(): string {
    return this.configService.get('RESEND_FROM_EMAIL', { infer: true });
  }

  public get resendConfigured(): boolean {
    return this.resendApiKey !== '';
  }

  public get objectStorageEndpoint(): string {
    return this.configService.get('OBJECT_STORAGE_ENDPOINT', { infer: true });
  }

  public get objectStorageRegion(): string {
    return this.configService.get('OBJECT_STORAGE_REGION', { infer: true });
  }

  public get objectStorageBucket(): string {
    return this.configService.get('OBJECT_STORAGE_BUCKET', { infer: true });
  }

  public get objectStorageAccessKeyId(): string {
    return this.configService.get('OBJECT_STORAGE_ACCESS_KEY_ID', { infer: true });
  }

  public get objectStorageSecretAccessKey(): string {
    return this.configService.get('OBJECT_STORAGE_SECRET_ACCESS_KEY', { infer: true });
  }

  public get objectStoragePublicBaseUrl(): string {
    return this.configService.get('OBJECT_STORAGE_PUBLIC_BASE_URL', { infer: true });
  }

  // Separate PUBLIC-read bucket for catalog/public assets (product images, etc.).
  // The default (private) bucket holds sensitive objects (KYC, identity) and must
  // never be public — so public assets get their own bucket + public base URL.
  public get objectStoragePublicBucket(): string {
    return this.configService.get('OBJECT_STORAGE_PUBLIC_BUCKET', { infer: true });
  }

  public get objectStorageConfigured(): boolean {
    return (
      this.objectStorageEndpoint !== '' &&
      this.objectStorageBucket !== '' &&
      this.objectStorageAccessKeyId !== '' &&
      this.objectStorageSecretAccessKey !== ''
    );
  }

  /**
   * Staged-launch activation flag for the Merchant module. `false` (default)
   * keeps every merchant-facing endpoint disabled (deployed-but-off) until the
   * controlled merchant pilot; `true` activates it. Admin merchant review/
   * approval and customer browse are unaffected.
   */
  public get merchantModuleEnabled(): boolean {
    return this.configService.get('MERCHANT_MODULE_ENABLED', { infer: true });
  }

  /**
   * When true, the merchant/driver/rider portals activate on EMAIL verification
   * alone — no phone OTP is dispatched at registration and phone verification is
   * not required to register or sign in. Temporary bridge while the Termii SMS
   * sender ID is pending approval (phone OTPs are undeliverable). Customer is
   * unaffected. Flip back to false to restore mandatory phone verification.
   */
  public get portalEmailActivation(): boolean {
    return this.configService.get('PORTAL_EMAIL_ACTIVATION', { infer: true });
  }
}
