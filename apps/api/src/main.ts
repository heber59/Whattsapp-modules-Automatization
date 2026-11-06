import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './configure-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const docsEnabled = configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), '127.0.0.1');
  const url = await app.getUrl();
  if (docsEnabled) Logger.log(`Swagger disponible en ${url}/docs`, 'Bootstrap');
}

void bootstrap().catch(() => {
  Logger.error('No se pudo iniciar la API. Revisa configuración y servicios locales.', 'Bootstrap');
  process.exit(1);
});
