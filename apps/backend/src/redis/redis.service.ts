import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';

import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly logger: Logger,
  ) {
    this.client = new Redis(this.appConfig.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  public async onModuleInit(): Promise<void> {
    this.client.on('error', (error: Error) => {
      this.logger.error({ err: error }, 'Redis client error');
    });
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  public async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  public getClient(): Redis {
    return this.client;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  public async ping(): Promise<string> {
    return await this.client.ping();
  }
}
