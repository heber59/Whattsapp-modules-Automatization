import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@wa/contracts';
import { DatabaseService } from '../shared/database/database.service';
import { QueueService } from '../shared/queue/queue.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: QueueService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, queue] = await Promise.allSettled([
      this.database.ping(), this.queue.ping(),
    ]);
    const healthy = database.status === 'fulfilled' && queue.status === 'fulfilled';
    return {
      status: healthy ? 'ok' : 'degraded',
      services: {
        database: database.status === 'fulfilled' ? 'ok' : 'unavailable',
        queue: queue.status === 'fulfilled' ? 'ok' : 'unavailable',
      },
    };
  }
}
