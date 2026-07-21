import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

import type { HealthCheckResult, HealthComponentStatus } from './health.types';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  public async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const statuses = [database.status, redis.status];
    const status: HealthCheckResult['status'] = statuses.every((item) => item === 'up')
      ? 'ok'
      : statuses.every((item) => item === 'down')
        ? 'error'
        : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<HealthComponentStatus> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Database unreachable',
      };
    }
  }

  private async checkRedis(): Promise<HealthComponentStatus> {
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return {
          status: 'down',
          latencyMs: Date.now() - started,
          message: `Unexpected Redis response: ${pong}`,
        };
      }
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Redis unreachable',
      };
    }
  }
}
