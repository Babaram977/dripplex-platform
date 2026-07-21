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

  public get logLevel(): EnvConfig['LOG_LEVEL'] {
    return this.configService.get('LOG_LEVEL', { infer: true });
  }
}
