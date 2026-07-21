import { Injectable } from '@nestjs/common';

import { LoginAttemptsExceededDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LoginAttemptService {
  constructor(
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
  ) {}

  public async assertNotLocked(email: string, ipAddress?: string): Promise<void> {
    const emailLockKey = this.emailLockKey(email);
    const emailLocked = await this.redis.get(emailLockKey);
    if (emailLocked) {
      const retryAfter = Math.max(await this.redis.ttl(emailLockKey), 1);
      throw new LoginAttemptsExceededDomainException(
        'Login temporarily locked for this account',
        retryAfter,
      );
    }

    if (ipAddress) {
      const ipLockKey = this.ipLockKey(ipAddress);
      const ipLocked = await this.redis.get(ipLockKey);
      if (ipLocked) {
        const retryAfter = Math.max(await this.redis.ttl(ipLockKey), 1);
        throw new LoginAttemptsExceededDomainException(
          'Login temporarily locked for this IP address',
          retryAfter,
        );
      }
    }
  }

  public async recordFailure(email: string, ipAddress?: string): Promise<void> {
    await this.incrementCounter(
      this.emailFailKey(email),
      this.appConfig.loginMaxAttemptsPerEmail,
      this.emailLockKey(email),
    );

    if (ipAddress) {
      await this.incrementCounter(
        this.ipFailKey(ipAddress),
        this.appConfig.loginMaxAttemptsPerIp,
        this.ipLockKey(ipAddress),
      );
    }
  }

  public async resetFailures(email: string, ipAddress?: string): Promise<void> {
    await this.redis.del(this.emailFailKey(email));
    await this.redis.del(this.emailLockKey(email));

    if (ipAddress) {
      await this.redis.del(this.ipFailKey(ipAddress));
      await this.redis.del(this.ipLockKey(ipAddress));
    }
  }

  private async incrementCounter(
    counterKey: string,
    maxAttempts: number,
    lockKey: string,
  ): Promise<void> {
    const attempts = await this.redis.incr(counterKey);
    if (attempts === 1) {
      await this.redis.expire(counterKey, this.appConfig.loginLockoutSeconds);
    }

    if (attempts >= maxAttempts) {
      await this.redis.set(lockKey, '1', this.appConfig.loginLockoutSeconds);
    }
  }

  private emailFailKey(email: string): string {
    return `auth:login:fail:${email.toLowerCase()}`;
  }

  private emailLockKey(email: string): string {
    return `auth:login:lock:${email.toLowerCase()}`;
  }

  private ipFailKey(ipAddress: string): string {
    return `auth:login:fail:ip:${ipAddress}`;
  }

  private ipLockKey(ipAddress: string): string {
    return `auth:login:lock:ip:${ipAddress}`;
  }
}
