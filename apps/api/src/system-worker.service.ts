import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { SYSTEM_PING, SYSTEM_QUEUE } from './shared/queue/queue.constants';

@Injectable()
export class SystemWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemWorkerService.name);
  private readonly connection: Redis;
  private readonly worker: Worker;

  constructor(config: ConfigService) {
    this.connection = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 3000,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    this.connection.on('error', () => this.logger.warn('Worker connection to Redis interrupted'));
    this.worker = new Worker(SYSTEM_QUEUE, async (job) => {
      if (job.name !== SYSTEM_PING) throw new Error('Unsupported system job');
      return { status: 'ok' };
    }, { connection: this.connection, autorun: false });
    this.worker.on('error', () => this.logger.error('Worker connection or execution error'));
    this.worker.on('failed', () => this.logger.warn('Job failed; check the system queue'));
  }

  async onModuleInit(): Promise<void> {
    await this.worker.waitUntilReady();
    void this.worker.run().catch(() => this.logger.error('The worker stopped'));
    this.logger.log('System worker ready');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
  }
}
