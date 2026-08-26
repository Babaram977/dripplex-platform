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

  public get peyflexBaseUrl(): string {
    return this.configService.get('PEYFLEX_BASE_URL', { infer: true });
  }

  public get peyflexApiToken(): string {
    return this.configService.get('PEYFLEX_API_TOKEN', { infer: true });
  }

  /** True once a Peyflex token exists. Until then the Utilities feature is
   * deployed but disabled, and the not-configured adapter answers. */
  public get peyflexConfigured(): boolean {
    return this.peyflexApiToken.trim().length > 0;
  }

  public get peyflexFloatLowBalanceThreshold(): number {
    return this.configService.get('PEYFLEX_FLOAT_LOW_BALANCE_THRESHOLD', { infer: true });
  }

  /**
   * Whether a card gateway can actually take a payment.
   *
   * A secret key is what makes a provider real — the public key alone only
   * renders a form. Checked so the client can hide a Card button rather than
   * offer one that fails after the customer has chosen what to buy, the same
   * deployed-but-disabled pattern the utilities provider uses.
   */
  public get paystackConfigured(): boolean {
    return this.paystackSecretKey.trim().length > 0;
  }

  public get flutterwaveConfigured(): boolean {
    return this.flutterwaveSecretKey.trim().length > 0;
  }

  public get cardPaymentsEnabled(): boolean {
    return this.paystackConfigured || this.flutterwaveConfigured;
  }

  /**
   * Every card gateway that can actually take a payment right now.
   *
   * Founder decision (2026-08-18): keep BOTH Paystack and Flutterwave live and
   * let the customer choose, because one can be down while the other is fine.
   * So this is a list, not a winner — the client renders one option per entry
   * and a gateway with no secret key simply never appears.
   */
  public get availableCardProviders(): ('PAYSTACK' | 'FLUTTERWAVE')[] {
    const providers: ('PAYSTACK' | 'FLUTTERWAVE')[] = [];
    if (this.paystackConfigured) providers.push('PAYSTACK');
    if (this.flutterwaveConfigured) providers.push('FLUTTERWAVE');
    return providers;
  }

  /**
   * The gateway a plain "pay by card" should use.
   *
   * PAYMENT_DEFAULT_PROVIDER wins when that provider is actually configured;
   * otherwise the other configured one is used, so a default left pointing at
   * a gateway with no key does not silently disable card payments. OPay is
   * excluded — it is safe-disabled platform-wide (DPX-D1).
   */
  public get defaultCardProvider(): 'PAYSTACK' | 'FLUTTERWAVE' | null {
    const preferred = this.paymentDefaultProvider;
    if (preferred === 'PAYSTACK' && this.paystackConfigured) return 'PAYSTACK';
    if (preferred === 'FLUTTERWAVE' && this.flutterwaveConfigured) return 'FLUTTERWAVE';
    if (this.flutterwaveConfigured) return 'FLUTTERWAVE';
    if (this.paystackConfigured) return 'PAYSTACK';
    return null;
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

  public get livekitUrl(): string {
    return this.configService.get('LIVEKIT_URL', { infer: true });
  }

  public get livekitApiKey(): string {
    return this.configService.get('LIVEKIT_API_KEY', { infer: true });
  }

  public get livekitApiSecret(): string {
    return this.configService.get('LIVEKIT_API_SECRET', { infer: true });
  }

  /** DPX-MOBILE-002 — all three are required. A URL without a key mints
   * nothing, and a key without a URL leaves the client nowhere to connect. */
  public get livekitConfigured(): boolean {
    return this.livekitUrl !== '' && this.livekitApiKey !== '' && this.livekitApiSecret !== '';
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

  /**
   * Whether ANY biometric identity provider can actually run a check.
   *
   * Smile ID is the only one wired today, and it throws "Smile ID is not
   * configured" without credentials. Nothing may *demand* a biometric check
   * while this is false: a check that cannot be satisfied is not a control,
   * it is a locked door. Onboarding still requires identity — an operator
   * clears it by manual review.
   */
  public get biometricIdentityVerificationAvailable(): boolean {
    return this.smileIdConfigured;
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
