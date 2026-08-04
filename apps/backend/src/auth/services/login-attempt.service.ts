import { Injectable } from '@nestjs/common';

import { LoginAttemptsExceededDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LoginAttemptService {
  constructor(
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
    private readonly eventBus: DomainEventBus,
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
    const emailJustLocked = await this.incrementCounter(
      this.emailFailKey(email),
      this.appConfig.loginMaxAttemptsPerEmail,
      this.emailLockKey(email),
    );
    if (emailJustLocked) {
      // DPX-DS-001: a lockout episode is a driver identity-verification
      // risk signal. Scoped to the per-email lock only — the per-IP lock
      // below isn't tied to a single account.
      await this.eventBus.emit(DOMAIN_EVENTS.LOGIN_LOCKED, { email: email.toLowerCase() });
    }

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

  /** Returns true the moment this call causes the lock to be set (not on
   * subsequent calls once already locked). */
  private async incrementCounter(
    counterKey: string,
    maxAttempts: number,
    lockKey: string,
  ): Promise<boolean> {
    const attempts = await this.redis.incr(counterKey);
    if (attempts === 1) {
      await this.redis.expire(counterKey, this.appConfig.loginLockoutSeconds);
    }

    if (attempts >= maxAttempts) {
      await this.redis.set(lockKey, '1', this.appConfig.loginLockoutSeconds);
      return attempts === maxAttempts;
    }
    return false;
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
