import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { WorkerModule } from '../src/worker.module';
import { SYSTEM_PING, SYSTEM_QUEUE } from '../src/shared/queue/queue.constants';

test('the worker processes a real job without starting the API or PostgreSQL', { timeout: 20000 }, async () => {
  const worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false, abortOnError: false });
  const redisUrl = worker.get(ConfigService).getOrThrow<string>('REDIS_URL');
  const producer = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const eventsConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  producer.on('error', () => {});
  eventsConnection.on('error', () => {});
  const queue = new Queue(SYSTEM_QUEUE, { connection: producer });
  const events = new QueueEvents(SYSTEM_QUEUE, { connection: eventsConnection });
  try {
    await events.waitUntilReady();
    const job = await queue.add(SYSTEM_PING, {}, {
      jobId: randomUUID(), removeOnComplete: true, removeOnFail: true,
    });
    assert.deepEqual(await job.waitUntilFinished(events, 10000), { status: 'ok' });
  } finally {
    await worker.close();
    await events.close();
    await queue.close();
    producer.disconnect();
    eventsConnection.disconnect();
  }
});
