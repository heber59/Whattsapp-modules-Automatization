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
    this.connection.on('error', () => this.logger.warn('Conexión del worker a Redis interrumpida'));
    this.worker = new Worker(SYSTEM_QUEUE, async (job) => {
      if (job.name !== SYSTEM_PING) throw new Error('Trabajo de sistema no soportado');
      return { status: 'ok' };
    }, { connection: this.connection, autorun: false });
    this.worker.on('error', () => this.logger.error('Error de conexión o ejecución del worker'));
    this.worker.on('failed', () => this.logger.warn('Trabajo fallido; revisar la cola de sistema'));
  }

  async onModuleInit(): Promise<void> {
    await this.worker.waitUntilReady();
    void this.worker.run().catch(() => this.logger.error('El worker se detuvo'));
    this.logger.log('Worker de sistema listo');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
  }
}
