import { HealthService } from './health.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const redis = {
    ping: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const service = new HealthService(prisma, redis);

  it('returns ok when database and redis are healthy', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    (redis.ping as jest.Mock).mockResolvedValue('PONG');

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.redis.status).toBe('up');
  });

  it('returns degraded when redis is down', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    (redis.ping as jest.Mock).mockRejectedValue(new Error('connection refused'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.redis.status).toBe('down');
  });

  it('returns error when both dependencies are down', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('db down'));
    (redis.ping as jest.Mock).mockRejectedValue(new Error('redis down'));

    const result = await service.check();

    expect(result.status).toBe('error');
  });
});
