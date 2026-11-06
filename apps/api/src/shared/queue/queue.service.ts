import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3000),
    });
    this.client.on('error', () => this.logger.warn('Redis no está disponible'));
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.ping();
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
