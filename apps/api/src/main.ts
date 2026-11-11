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
  await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HTTP_HOST'));
  const url = await app.getUrl();
  if (docsEnabled) Logger.log(`Swagger available at ${url}/docs`, 'Bootstrap');
}

void bootstrap().catch(() => {
  Logger.error('Could not start the API. Check configuration and local services.', 'Bootstrap');
  process.exit(1);
});
