import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

test('la API HTTP verifica PostgreSQL y Redis sin iniciar el worker', { timeout: 15000 }, async () => {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch((await app.getUrl()) + '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'ok', services: { database: 'ok', queue: 'ok' },
    });
  } finally {
    await app.close();
  }
});
