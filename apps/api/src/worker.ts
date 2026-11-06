import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}

void bootstrap().catch(() => {
  Logger.error('No se pudo iniciar el worker. Revisa configuración y Redis.', 'Bootstrap');
  process.exit(1);
});
