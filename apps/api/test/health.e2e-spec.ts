import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/configure-http';
import { validateEnvironment } from '../src/shared/config/config';

async function createApp(mode: 'test' | 'production') {
  const config = {
    ...validateEnvironment(process.env), NODE_ENV: mode,
    RATE_LIMIT_PREFIX: 'wa:swagger:' + randomUUID(),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService(config)).compile();
  const app = module.createNestApplication({ logger: false });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  return app;
}

test('API saludable, Swagger navegable y rutas privadas protegidas', { timeout: 15000 }, async () => {
  const app = await createApp('test');
  try {
    const base = await app.getUrl();
    const health = await fetch(base + '/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', services: { database: 'ok', queue: 'ok' } });

    const root = await fetch(base + '/', { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/docs');
    const docs = await fetch(base + '/docs');
    assert.equal(docs.status, 200);
    assert((await docs.text()).includes('Whattsapp Automatization'));
    assert.equal((await fetch(base + '/docs/swagger-ui-bundle.js')).status, 200);

    const specification = await fetch(base + '/docs-json');
    assert.equal(specification.status, 200);
    const schema = await specification.json();
    assert.equal(schema.info.title, 'Whattsapp Automatization');
    assert.equal(schema.components.securitySchemes.supabase.scheme, 'bearer');
    assert.deepEqual(schema.paths['/health'].get.security, []);
    assert.deepEqual(schema.paths['/auth/login'].post.security, []);
    assert.deepEqual(schema.paths['/auth/login'].post.requestBody.content['application/json'].schema.required, ['email', 'password']);
    assert.deepEqual(schema.paths['/identity/me'].get.security, [{ supabase: [] }]);
    assert.deepEqual(schema.paths['/businesses'].post.requestBody.content['application/json'].schema.required, ['name']);
    assert.equal(schema.paths['/businesses/{id}'].get.parameters[0].name, 'id');
    assert.equal((await fetch(base + '/identity/me')).status, 401);
  } finally { await app.close(); }
});

test('Swagger y redirección no se exponen en producción', { timeout: 15000 }, async () => {
  const app = await createApp('production');
  try {
    const base = await app.getUrl();
    for (const url of ['/', '/docs', '/docs-json']) {
      assert.equal((await fetch(base + url, { redirect: 'manual' })).status, 404);
    }
    assert.equal((await fetch(base + '/health')).status, 200);
  } finally { await app.close(); }
});
