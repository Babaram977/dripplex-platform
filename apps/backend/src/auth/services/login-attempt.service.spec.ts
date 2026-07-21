import { LoginAttemptsExceededDomainException } from '../../common/exceptions/domain.exception';

import { LoginAttemptService } from './login-attempt.service';

import type { AppConfigService } from '../../config/app-config.service';
import type { RedisService } from '../../redis/redis.service';

describe('LoginAttemptService', () => {
  const redis = {
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const appConfig = {
    loginMaxAttemptsPerEmail: 10,
    loginMaxAttemptsPerIp: 30,
    loginLockoutSeconds: 900,
  } as unknown as AppConfigService;

  const service = new LoginAttemptService(redis, appConfig);

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (redis.set as jest.Mock).mockResolvedValue(undefined);
    (redis.del as jest.Mock).mockResolvedValue(undefined);
    (redis.ttl as jest.Mock).mockResolvedValue(120);
  });

  it('locks out after repeated failures', async () => {
    (redis.incr as jest.Mock).mockResolvedValue(10);

    await service.recordFailure('ada@example.com', '127.0.0.1');

    expect(redis.set).toHaveBeenCalledWith('auth:login:lock:ada@example.com', '1', 900);
  });

  it('throws when account is locked', async () => {
    (redis.get as jest.Mock).mockResolvedValue('1');

    await expect(service.assertNotLocked('ada@example.com')).rejects.toBeInstanceOf(
      LoginAttemptsExceededDomainException,
    );
  });

  it('resets counters after successful login', async () => {
    await service.resetFailures('ada@example.com', '127.0.0.1');

    expect(redis.del).toHaveBeenCalledWith('auth:login:fail:ada@example.com');
    expect(redis.del).toHaveBeenCalledWith('auth:login:lock:ada@example.com');
  });
});
