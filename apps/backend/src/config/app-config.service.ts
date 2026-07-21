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

  public get logLevel(): EnvConfig['LOG_LEVEL'] {
    return this.configService.get('LOG_LEVEL', { infer: true });
  }

  public get sentryDsn(): string | undefined {
    return this.configService.get('SENTRY_DSN', { infer: true });
  }

  public get sentryEnvironment(): string {
    return this.configService.get('SENTRY_ENVIRONMENT', { infer: true });
  }

  public get metricsEnabled(): boolean {
    return this.configService.get('METRICS_ENABLED', { infer: true });
  }
}
