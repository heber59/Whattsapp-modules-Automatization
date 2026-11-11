import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureHttp(app: INestApplication): boolean {
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.getOrThrow<string>('WEB_ORIGIN') });
  if (config.get<string>('NODE_ENV') === 'production') return false;

  const options = new DocumentBuilder()
    .setTitle('Whattsapp Automatization')
    .setDescription('Micro-SaaS API. Private routes require a Supabase access_token, not a project key.')
    .setVersion('0.1.0')
    .addBearerAuth({
      type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
      description: 'Supabase session access token. Enter the token only.',
    }, 'supabase')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, options), {
    jsonDocumentUrl: '/docs-json',
    raw: ['json'],
    customSiteTitle: 'Whattsapp Automatization · API',
    swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
  });
  const adapter = app.getHttpAdapter();
  adapter.get('/', (_request: unknown, response: unknown) => adapter.redirect(response, 302, '/docs'));
  return true;
}
