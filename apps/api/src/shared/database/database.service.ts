import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 5,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      idleTimeoutMillis: 10000,
    });
    this.pool.on('error', () => {
      this.logger.warn('Conexión inactiva a PostgreSQL interrumpida');
    });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleInit(): Promise<void> {
    await this.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
