import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { WorkerModule } from '../src/worker.module';
import { SYSTEM_PING, SYSTEM_QUEUE } from '../src/shared/queue/queue.constants';
import { FixtureCleanup } from './fixture-cleanup';

test('the worker processes a real job without starting the API or PostgreSQL', { timeout: 20000 }, async () => {
  const cleanup = new FixtureCleanup();
  const worker = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
  worker.useLogger(false);
  cleanup.add(() => worker.close());
  try {
    await worker.init();
    const redisUrl = worker.get(ConfigService).getOrThrow<string>('REDIS_URL');
    const producer = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    cleanup.add(() => producer.disconnect());
    const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    cleanup.add(() => eventsConnection.disconnect());
    producer.on('error', () => {});
    eventsConnection.on('error', () => {});
    const queue = new Queue(SYSTEM_QUEUE, { connection: producer });
    cleanup.add(() => queue.close());
    const events = new QueueEvents(SYSTEM_QUEUE, { connection: eventsConnection });
    cleanup.add(() => events.close());
    await events.waitUntilReady();
    const job = await queue.add(SYSTEM_PING, {}, {
      jobId: randomUUID(), removeOnComplete: true, removeOnFail: true,
    });
    assert.deepEqual(await job.waitUntilFinished(events, 10000), { status: 'ok' });
  } finally {
    await cleanup.close();
  }
});
