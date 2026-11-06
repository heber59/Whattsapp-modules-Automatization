import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.getOrThrow<string>('WEB_ORIGIN') });
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), '127.0.0.1');
}

void bootstrap().catch(() => {
  Logger.error('No se pudo iniciar la API. Revisa configuración y servicios locales.', 'Bootstrap');
  process.exit(1);
});
