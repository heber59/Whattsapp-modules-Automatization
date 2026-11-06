import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/shared/database/database.service';
import { migrate } from '../src/shared/database/migrate';
import { validateEnvironment } from '../src/shared/config/config';

async function fixture(overrides: Record<string, unknown> = {}) {
  const identities = { alice: randomUUID(), bob: randomUUID(), anonymous: randomUUID() };
  let providerCalls = 0;
  const provider = createServer(async (request, response) => {
    providerCalls++;
    response.setHeader('Content-Type', 'application/json');
    if (request.url?.startsWith('/auth/v1/token')) {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      const credentials = JSON.parse(raw) as { email?: string; password?: string };
      if (credentials.email === 'outage@example.invalid') {
        response.writeHead(503).end(JSON.stringify({ message: 'test provider unavailable' }));
        return;
      }
      const token = credentials.email === 'alice@example.invalid' ? 'alice'
        : credentials.email === 'bob@example.invalid' ? 'bob' : undefined;
      if (!token || credentials.password !== ' fixture password ') {
        response.writeHead(400).end(JSON.stringify({ message: 'invalid login credentials', code: 'invalid_credentials' }));
        return;
      }
      response.end(JSON.stringify({
        access_token: token, token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh-' + token,
        user: { id: identities[token], email: credentials.email, aud: 'authenticated', role: 'authenticated',
          created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} },
      }));
      return;
    }
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (token === 'outage') {
      response.writeHead(503).end(JSON.stringify({ message: 'test provider unavailable' }));
      return;
    }
    if (!token || !(token in identities)) {
      response.writeHead(401).end(JSON.stringify({ message: 'invalid token', code: 'bad_jwt' }));
      return;
    }
    const subject = identities[token as keyof typeof identities];
    response.end(JSON.stringify({
      id: subject, email: token + '@example.invalid', aud: 'authenticated',
      role: 'authenticated', is_anonymous: token === 'anonymous',
      created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: {}, user_metadata: { role: 'owner', business_id: randomUUID() },
    }));
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const base = validateEnvironment(process.env);
  assert(['localhost', '127.0.0.1'].includes(new URL(base.DATABASE_URL).hostname), 'Usar solo PostgreSQL de pruebas local');
  const settings = {
    ...base, NODE_ENV: 'test',
    SUPABASE_URL: 'http://127.0.0.1:' + (provider.address() as AddressInfo).port,
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    RATE_LIMIT_PREFIX: 'wa:test:' + randomUUID(),
    RATE_LIMIT_IP_LIMIT: 100, RATE_LIMIT_USER_LIMIT: 100, RATE_LIMIT_WINDOW_MS: 3600000,
    ...overrides,
  };
  await migrate(base.DATABASE_URL);
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService).useValue(new ConfigService(settings)).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const database = app.get(DatabaseService);
  const redis = new Redis(base.REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
  const request = (url: string, token?: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(app.getHttpServer().address() ? 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port + url : '', {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    identities, request, database, get providerCalls() { return providerCalls; },
    async close() {
      try {
        await database.query(`DELETE FROM app.businesses WHERE created_by IN
          (SELECT id FROM app.users WHERE auth_user_id = ANY($1::uuid[]))`, [Object.values(identities)]);
        await database.query('DELETE FROM app.users WHERE auth_user_id = ANY($1::uuid[])', [Object.values(identities)]);
        let cursor = '0';
        do {
          const scan = await redis.scan(cursor, 'MATCH', settings.RATE_LIMIT_PREFIX + ':*', 'COUNT', 100);
          cursor = scan[0];
          if (scan[1].length) await redis.del(...scan[1]);
        } while (cursor !== '0');
      } finally {
        redis.disconnect();
        await app.close();
        provider.closeAllConnections();
        await new Promise<void>((resolve) => provider.close(() => resolve()));
      }
    },
  };
}

test('sesión, membresías y datos de varios negocios permanecen aislados', { timeout: 30000 }, async () => {
  const context = await fixture();
  try {
    assert.equal((await context.request('/identity/me')).status, 401);
    assert.equal((await context.request('/identity/me', 'invalid')).status, 401);
    assert.equal((await context.request('/identity/me', 'anonymous')).status, 401);
    assert.equal((await context.request('/identity/me', 'outage')).status, 503);
    assert.equal((await context.request('/businesses', 'alice', { name: 'Inválido', role: 'owner' })).status, 400);
    const aResponse = await context.request('/businesses', 'alice', { name: 'Negocio A' });
    assert.equal(aResponse.status, 201);
    const a = await aResponse.json() as { id: string };
    const a2 = await (await context.request('/businesses', 'alice', { name: 'Segundo negocio A' })).json() as { id: string };
    const b = await (await context.request('/businesses', 'bob', { name: 'Negocio B' })).json() as { id: string };
    const aliceList = await (await context.request('/businesses', 'alice')).json() as { id: string }[];
    assert.deepEqual(new Set(aliceList.map((business) => business.id)), new Set([a.id, a2.id]));
    assert.equal((await context.request('/businesses/' + b.id, 'alice')).status, 404);
    assert.equal((await context.request('/businesses/' + a.id, 'bob', undefined, {
      'X-User-Id': context.identities.alice, 'X-Role': 'owner',
    })).status, 404);

    const bob = await (await context.request('/identity/me', 'bob')).json() as { id: string };
    await context.database.query("INSERT INTO app.memberships(business_id, user_id, role) VALUES ($1, $2, 'operator')", [a.id, bob.id]);
    const membership = await (await context.request('/businesses/' + a.id, 'bob')).json() as { role: string };
    assert.equal(membership.role, 'operator');

    for (const name of ['Producto 1', 'Producto 2']) {
      await context.database.query('INSERT INTO app.products(business_id, name, price) VALUES ($1, $2, 1500.50)', [a.id, name]);
    }
    for (let i = 0; i < 2; i++) {
      await context.database.query('INSERT INTO app.whatsapp_numbers(business_id, phone_e164) VALUES ($1, $2)',
        [a.id, '+57' + randomInt(10000000000, 99999999999)]);
    }
    await assert.rejects(
      context.database.query("INSERT INTO app.products(business_id, name, price) VALUES ($1, 'Negativo', -1)", [a.id]),
      { code: '23514' },
    );
    await assert.rejects(
      context.database.query("INSERT INTO app.products(business_id, name, price) VALUES ($1, 'Huérfano', 10)", [randomUUID()]),
      { code: '23503' },
    );
  } finally { await context.close(); }
});

test('el límite por usuario es atómico y no bloquea a otra cuenta de la misma IP', { timeout: 20000 }, async () => {
  const context = await fixture({ RATE_LIMIT_USER_LIMIT: 3 });
  try {
    const responses = await Promise.all(Array.from({ length: 12 }, () => context.request('/identity/me', 'alice')));
    assert.equal(responses.filter((response) => response.status === 200).length, 3);
    assert.equal(responses.filter((response) => response.status === 429).length, 9);
    assert(responses.filter((response) => response.status === 429).every((response) => Number(response.headers.get('Retry-After')) > 0));
    assert.equal((await context.request('/identity/me', 'bob')).status, 200);
  } finally { await context.close(); }
});

test('el bucket por IP se aplica antes del proveedor y no acepta IP de headers arbitrarios', { timeout: 15000 }, async () => {
  const context = await fixture({ RATE_LIMIT_IP_LIMIT: 2 });
  try {
    assert.equal((await context.request('/identity/me', 'bad', undefined, { 'X-Forwarded-For': '192.0.2.1' })).status, 401);
    assert.equal((await context.request('/identity/me', 'bad', undefined, { 'X-Forwarded-For': '192.0.2.2' })).status, 401);
    const blocked = await context.request('/identity/me', 'alice', undefined, { 'X-Forwarded-For': '192.0.2.3' });
    assert.equal(blocked.status, 429);
    assert.equal(context.providerCalls, 2);
  } finally { await context.close(); }
});

test('sin configuración de Supabase no se habilitan rutas privadas', { timeout: 15000 }, async () => {
  // Vacíos explícitos: ConfigService no debe recurrir a credenciales reales del entorno.
  const context = await fixture({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' });
  try {
    assert.equal((await context.request('/identity/me', 'alice')).status, 503);
    assert.equal((await context.request('/health')).status, 200);
    assert.equal(context.providerCalls, 0);
  } finally { await context.close(); }
});

test('login HTTP devuelve una sesión utilizable y no comparte sesiones entre usuarios', { timeout: 20000 }, async () => {
  const context = await fixture();
  try {
    const results = await Promise.all([
      context.request('/auth/login', undefined, { email: ' ALICE@EXAMPLE.INVALID ', password: ' fixture password ' }),
      context.request('/auth/login', undefined, { email: 'bob@example.invalid', password: ' fixture password ' }),
    ]);
    for (const response of results) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    const sessions = await Promise.all(results.map((response) => response.json())) as { access_token: string }[];
    assert.equal(sessions[0]?.access_token, 'alice');
    assert.equal(sessions[1]?.access_token, 'bob');
    for (const [index, name] of ['alice', 'bob'].entries()) {
      const profileResponse = await context.request('/identity/me', sessions[index]!.access_token);
      assert.equal(profileResponse.status, 200);
      const profile = await profileResponse.json() as { auth_user_id: string };
      assert.equal(profile.auth_user_id, context.identities[name as 'alice' | 'bob']);
    }
    assert.equal((await context.request('/auth/login', undefined, { email: 'alice@example.invalid', password: 'x', role: 'owner' })).status, 400);
    const wrong = await context.request('/auth/login', undefined, { email: 'alice@example.invalid', password: 'wrong' });
    const missing = await context.request('/auth/login', undefined, { email: 'missing@example.invalid', password: 'wrong' });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    assert.deepEqual(await wrong.json(), await missing.json());
  } finally { await context.close(); }
});

test('login limita la cuenta normalizada antes del proveedor y conserva el cupo de otras cuentas', { timeout: 20000 }, async () => {
  const context = await fixture({ RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: 2 });
  try {
    assert.equal((await context.request('/auth/login', undefined, { email: 'alice@example.invalid', password: 'wrong' })).status, 401);
    assert.equal((await context.request('/auth/login', undefined, { email: ' ALICE@EXAMPLE.INVALID ', password: 'wrong' })).status, 401);
    const blocked = await context.request('/auth/login', undefined, { email: 'alice@example.invalid', password: ' fixture password ' });
    assert.equal(blocked.status, 429);
    assert(Number(blocked.headers.get('Retry-After')) > 0);
    assert.equal(context.providerCalls, 2);
    assert.equal((await context.request('/auth/login', undefined, { email: 'bob@example.invalid', password: ' fixture password ' })).status, 200);
  } finally { await context.close(); }
});
