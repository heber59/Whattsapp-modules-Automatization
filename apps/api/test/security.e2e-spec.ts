import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/shared/database/database.service';
import { migrate } from '../src/shared/database/migrate';
import { validateEnvironment } from '../src/shared/config/config';
import { FixtureCleanup } from './fixture-cleanup';

async function fixture(overrides: Record<string, unknown> = {}) {
  const cleanup = new FixtureCleanup();
  const identities = { alice: randomUUID(), bob: randomUUID(), anonymous: randomUUID() };
  const refreshTokens = new Map<string, 'alice' | 'bob'>();
  let logoutScope: string | null = null;
  let providerCalls = 0;
  const provider = createServer(async (request, response) => {
    providerCalls++;
    response.setHeader('Content-Type', 'application/json');
    if (request.url?.startsWith('/auth/v1/signup')) {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      const input = JSON.parse(raw) as { email: string; password: string };
      assert.equal(input.password.length >= 8, true);
      response.end(JSON.stringify({ id: randomUUID(), email: input.email, aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} }));
      return;
    }
    if (request.url?.startsWith('/auth/v1/token')) {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      const credentials = JSON.parse(raw) as { email?: string; password?: string; refresh_token?: string };
      if (request.url.includes('grant_type=refresh_token')) {
        if (credentials.refresh_token === 'outage') {
          response.writeHead(503).end(JSON.stringify({ message: 'test provider unavailable' }));
          return;
        }
        const token = refreshTokens.get(credentials.refresh_token ?? '');
        if (!token) {
          response.writeHead(400).end(JSON.stringify({ message: 'invalid refresh token', code: 'refresh_token_not_found' }));
          return;
        }
        refreshTokens.delete(credentials.refresh_token!);
        const refreshToken = randomUUID();
        refreshTokens.set(refreshToken, token);
        response.end(JSON.stringify({
          access_token: token, token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: refreshToken,
          user: { id: identities[token], aud: 'authenticated', role: 'authenticated',
            created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} },
        }));
        return;
      }
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
      refreshTokens.set('test-refresh-' + token, token);
      response.end(JSON.stringify({
        access_token: token, token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh-' + token,
        user: { id: identities[token], email: credentials.email, aud: 'authenticated', role: 'authenticated',
          created_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {} },
      }));
      return;
    }
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (request.url?.startsWith('/auth/v1/logout')) {
      if (token === 'expired') {
        response.writeHead(401).end(JSON.stringify({ message: 'expired JWT', code: 'bad_jwt' }));
        return;
      }
      if (token === 'outage') {
        response.writeHead(503).end(JSON.stringify({ message: 'test provider unavailable' }));
        return;
      }
      logoutScope = new URL(request.url, 'http://localhost').searchParams.get('scope');
      for (const [refreshToken, subject] of refreshTokens) if (subject === token) refreshTokens.delete(refreshToken);
      response.writeHead(204).end();
      return;
    }
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
  cleanup.add(async () => {
    provider.closeAllConnections();
    if (provider.listening) await new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      provider.once('error', reject);
      provider.listen(0, '127.0.0.1', resolve);
    });
    const base = validateEnvironment(process.env);
    assert(['localhost', '127.0.0.1'].includes(new URL(base.DATABASE_URL).hostname), 'Use local test PostgreSQL only');
    const settings = {
      ...base, NODE_ENV: 'test',
      SUPABASE_URL: 'http://127.0.0.1:' + (provider.address() as AddressInfo).port,
      SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      WEB_AUTH_SECRET: 'test-web-auth-secret-at-least-32-characters',
      RATE_LIMIT_PREFIX: 'wa:test:' + randomUUID(),
      RATE_LIMIT_IP_LIMIT: 100, RATE_LIMIT_USER_LIMIT: 100, RATE_LIMIT_WINDOW_MS: 3600000,
      ...overrides,
    };
    await migrate(base.DATABASE_URL);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService).useValue(new ConfigService(settings)).compile();
    const app = module.createNestApplication({ logger: false });
    cleanup.add(() => app.close());
    await app.listen(0, '127.0.0.1');
    const database = app.get(DatabaseService);
    const redis = new Redis(base.REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: 3000 });
    cleanup.add(() => redis.disconnect());
    redis.on('error', () => {});
    const request = (url: string, token?: string, body?: unknown, headers: Record<string, string> = {}, method?: string) =>
      fetch(app.getHttpServer().address() ? 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port + url : '', {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    return {
      identities, request, database, get providerCalls() { return providerCalls; }, get logoutScope() { return logoutScope; },
      async close() {
        try {
          await database.query(`DELETE FROM app.businesses WHERE created_by IN
            (SELECT id FROM app.users WHERE auth_user_id = ANY($1::uuid[]))`, [Object.values(identities)]);
          await database.query('DELETE FROM app.users WHERE auth_user_id = ANY($1::uuid[])', [Object.values(identities)]);
        } finally {
          try {
            let cursor = '0';
            do {
              const scan = await redis.scan(cursor, 'MATCH', settings.RATE_LIMIT_PREFIX + ':*', 'COUNT', 100);
              cursor = scan[0];
              if (scan[1].length) await redis.del(...scan[1]);
            } while (cursor !== '0');
          } finally { await cleanup.close(); }
        }
      },
    };
  } catch (error) { return cleanup.failed(error); }
}

test('failed initialization fixture probe', { skip: !process.env.WA_FIXTURE_FAILURE_PROBE }, async () => {
  await assert.rejects(fixture({ DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test' }), { code: 'ECONNREFUSED' });
});

test('Flow drafts isolate businesses, enforce roles and revisions, and publish immutable versions atomically', async () => {
  const f = await fixture({ RATE_LIMIT_USER_LIMIT: 200 });
  try {
    const business = await (await f.request('/businesses', 'alice', { name: 'Flow fixture' })).json() as { id: string };
    const path = '/businesses/' + business.id + '/flows';
    assert.equal((await f.request(path)).status, 401);
    assert.equal((await f.request(path, 'bob')).status, 404);
    const created = await (await f.request(path, 'alice', { name: 'Incomplete', steps: [] })).json() as { flow: { id: string; revision: number } };
    const flowPath = path + '/' + created.flow.id;
    assert.equal(created.flow.revision, 1);
    assert.equal((await f.request(flowPath + '/publish', 'alice', { expectedRevision: 1 })).status, 400);
    await f.request('/identity/me', 'bob');
    await f.database.query(`INSERT INTO app.memberships(business_id,user_id,role)
      SELECT $1,id,'operator' FROM app.users WHERE auth_user_id=$2`, [business.id, f.identities.bob]);
    assert.equal((await f.request(flowPath, 'bob')).status, 200);
    assert.equal((await f.request(path, 'bob', { name: 'Denied', steps: [] })).status, 403);
    assert.equal((await f.request(flowPath, 'bob', { name: 'Denied', steps: [], expectedRevision: 1 }, {}, 'PATCH')).status, 403);
    assert.equal((await f.request(flowPath + '/publish', 'bob', { expectedRevision: 1 })).status, 403);
    const steps = [
      { id: 's', kind: 'Start', text: 'Hi', x: 0, y: 0, choices: [{ label: 'Next', to: 'e' }] },
      { id: 'e', kind: 'End', text: 'Bye', x: 100, y: 0, choices: [] },
    ];
    const saves = await Promise.all([1, 2].map(() => f.request(flowPath, 'alice', { name: 'Saved', steps, expectedRevision: 1 }, {}, 'PATCH')));
    assert.deepEqual(saves.map((response) => response.status).sort(), [200, 409]);
    const published = await Promise.all([1, 2].map(async () => {
      const response = await f.request(flowPath + '/publish', 'alice', { expectedRevision: 2 });
      assert.equal(response.status, 201);
      return response.json() as Promise<{ version: { version: number; sourceRevision: number; steps: unknown[] } }>;
    }));
    assert.deepEqual(published[0], published[1]);
    assert.equal(published[0]!.version.version, 1);
    assert.equal(published[0]!.version.sourceRevision, 2);
    assert.equal((await f.request(flowPath, 'alice', { name: 'Changed draft', steps: [], expectedRevision: 2 }, {}, 'PATCH')).status, 200);
    const version = await f.request(flowPath + '/versions/1', 'bob');
    assert.deepEqual(await version.json(), published[0]);
    assert.deepEqual(await (await f.request(flowPath + '/publish', 'alice', { expectedRevision: 2 })).json(), published[0]);
    assert.equal((await f.request(flowPath + '/publish', 'alice', { expectedRevision: 1 })).status, 409);
    await assert.rejects(f.database.query("UPDATE app.flow_versions SET name='tamper' WHERE business_id=$1", [business.id]), /immutable/);
    const other = await (await f.request('/businesses', 'bob', { name: 'Other business' })).json() as { id: string };
    assert.equal((await f.request('/businesses/' + other.id + '/flows/' + created.flow.id, 'bob')).status, 404);
    await f.database.query("UPDATE app.memberships SET role='admin' WHERE business_id=$1 AND user_id=(SELECT id FROM app.users WHERE auth_user_id=$2)", [business.id, f.identities.bob]);
    assert.equal((await f.request(flowPath, 'bob', { name: 'Admin edit', steps, expectedRevision: 3 }, {}, 'PATCH')).status, 200);
    const v2 = await (await f.request(flowPath + '/publish', 'bob', { expectedRevision: 4 })).json() as { version: { version: number } };
    assert.equal(v2.version.version, 2);
  } finally { await f.close(); }
});

test('Signup and commercial requests preserve credentials and authenticated purchase boundaries', async () => {
  const f = await fixture();
  const email = randomUUID() + '@example.invalid';
  try {
    const signup = await f.request('/auth/web/signup', undefined, { email, password: 'password123' },
      { 'x-web-auth-key': 'test-web-auth-secret-at-least-32-characters' });
    assert.equal(signup.status, 200);
    assert.deepEqual(await signup.json(), { status: 'signup_requested' });
    assert.equal((await f.request('/auth/web/signup', undefined, { email, password: 'password123' })).status, 401);
    assert.equal((await f.request('/commercial/leads', undefined, { email, consent: true })).status, 201);
    assert.equal((await f.request('/commercial/purchase-requests', undefined, { email, consent: true, plan: 'full-access' })).status, 401);
    const purchase = await f.request('/commercial/purchase-requests', 'alice', { email, consent: true, plan: 'full-access' });
    assert.equal(purchase.status, 201);
    assert.deepEqual(await purchase.json(), { status: 'pending_contact' });
    const rows = await f.database.query('SELECT kind, status, auth_user_id, plan FROM app.commercial_requests WHERE email = $1 ORDER BY kind', [email]);
    assert.equal(rows.rowCount, 2);
    assert.equal(rows.rows[0]?.auth_user_id, null);
    assert.equal(rows.rows[1]?.auth_user_id, f.identities.alice);
    assert.equal(rows.rows[1]?.status, 'pending_contact');
    assert.equal(rows.rows[1]?.plan, 'full-access');
  } finally {
    await f.database.query('DELETE FROM app.commercial_requests WHERE email = $1', [email]);
    await f.close();
  }
});

test('failed fixture initialization releases sockets and exits without forced shutdown', { timeout: 20000 }, () => {
  const env: NodeJS.ProcessEnv = { ...process.env, WA_FIXTURE_FAILURE_PROBE: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--require', 'ts-node/register', '--test',
    '--test-name-pattern=^failed initialization fixture probe$', __filename], {
    env, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /ok 1 - failed initialization fixture probe/);
});

test('sessions, memberships, and business data remain isolated', { timeout: 30000 }, async () => {
  const context = await fixture();
  try {
    assert.equal((await context.request('/identity/me')).status, 401);
    assert.equal((await context.request('/identity/me', 'invalid')).status, 401);
    assert.equal((await context.request('/identity/me', 'anonymous')).status, 401);
    assert.equal((await context.request('/identity/me', 'outage')).status, 503);
    assert.equal((await context.request('/businesses', 'alice', { name: 'Invalid', role: 'owner' })).status, 400);
    const aResponse = await context.request('/businesses', 'alice', { name: 'Business A' });
    assert.equal(aResponse.status, 201);
    const a = await aResponse.json() as { id: string };
    const a2 = await (await context.request('/businesses', 'alice', { name: 'Second business A' })).json() as { id: string };
    const b = await (await context.request('/businesses', 'bob', { name: 'Business B' })).json() as { id: string };
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

    for (const name of ['Product 1', 'Product 2']) {
      await context.database.query('INSERT INTO app.products(business_id, name, price) VALUES ($1, $2, 1500.50)', [a.id, name]);
    }
    for (let i = 0; i < 2; i++) {
      await context.database.query('INSERT INTO app.whatsapp_numbers(business_id, phone_e164) VALUES ($1, $2)',
        [a.id, '+57' + randomInt(10000000000, 99999999999)]);
    }
    await assert.rejects(
      context.database.query("INSERT INTO app.products(business_id, name, price) VALUES ($1, 'Negative', -1)", [a.id]),
      { code: '23514' },
    );
    await assert.rejects(
      context.database.query("INSERT INTO app.products(business_id, name, price) VALUES ($1, 'Orphan', 10)", [randomUUID()]),
      { code: '23503' },
    );
  } finally { await context.close(); }
});

test('user limits are atomic and do not block another account on the same IP', { timeout: 20000 }, async () => {
  const context = await fixture({ RATE_LIMIT_USER_LIMIT: 3 });
  try {
    const responses = await Promise.all(Array.from({ length: 12 }, () => context.request('/identity/me', 'alice')));
    assert.equal(responses.filter((response) => response.status === 200).length, 3);
    assert.equal(responses.filter((response) => response.status === 429).length, 9);
    assert(responses.filter((response) => response.status === 429).every((response) => Number(response.headers.get('Retry-After')) > 0));
    assert.equal((await context.request('/identity/me', 'bob')).status, 200);
  } finally { await context.close(); }
});

test('IP limits run before provider calls and ignore arbitrary forwarded IP headers', { timeout: 15000 }, async () => {
  const context = await fixture({ RATE_LIMIT_IP_LIMIT: 2 });
  try {
    assert.equal((await context.request('/identity/me', 'bad', undefined, { 'X-Forwarded-For': '192.0.2.1' })).status, 401);
    assert.equal((await context.request('/identity/me', 'bad', undefined, { 'X-Forwarded-For': '192.0.2.2' })).status, 401);
    const blocked = await context.request('/identity/me', 'alice', undefined, { 'X-Forwarded-For': '192.0.2.3' });
    assert.equal(blocked.status, 429);
    assert.equal(context.providerCalls, 2);
  } finally { await context.close(); }
});

test('private routes remain unavailable without Supabase configuration', { timeout: 15000 }, async () => {
  // Explicit empty values prevent ConfigService from using real environment credentials.
  const context = await fixture({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' });
  try {
    assert.equal((await context.request('/identity/me', 'alice')).status, 503);
    assert.equal((await context.request('/health')).status, 200);
    assert.equal(context.providerCalls, 0);
  } finally { await context.close(); }
});

test('HTTP login returns a usable session without sharing sessions between users', { timeout: 20000 }, async () => {
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

test('login limits normalized accounts before provider calls without exhausting other accounts', { timeout: 20000 }, async () => {
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

test('web sessions require the server client and rotate refresh tokens before local sign-out', { timeout: 20000 }, async () => {
  const context = await fixture();
  const headers = { 'X-Web-Auth-Key': 'test-web-auth-secret-at-least-32-characters' };
  const credentials = { email: 'alice@example.invalid', password: ' fixture password ' };
  try {
    for (const endpoint of ['login', 'refresh', 'logout']) {
      assert.equal((await context.request('/auth/web/' + endpoint, undefined, {})).status, 401);
      assert.equal((await context.request('/auth/web/' + endpoint, undefined, {}, { 'X-Web-Auth-Key': 'wrong' })).status, 401);
    }
    assert.equal(context.providerCalls, 0);
    const response = await context.request('/auth/web/login', undefined, credentials, headers);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const session = await response.json() as { access_token: string; refresh_token: string };
    const renewed = await context.request('/auth/web/refresh', undefined, { refresh_token: session.refresh_token }, headers);
    assert.equal(renewed.status, 200);
    assert.equal(renewed.headers.get('Cache-Control'), 'no-store');
    const tokens = await renewed.json() as { access_token: string; refresh_token: string };
    const bobLogin = await context.request('/auth/web/login', undefined,
      { email: 'bob@example.invalid', password: ' fixture password ' }, headers);
    const bobTokens = await bobLogin.json() as { refresh_token: string };
    assert.notEqual(tokens.refresh_token, session.refresh_token);
    assert.equal((await context.request('/identity/me', tokens.access_token)).status, 200);
    assert.equal((await context.request('/auth/web/refresh', undefined, { refresh_token: session.refresh_token }, headers)).status, 401);
    assert.equal((await context.request('/auth/web/refresh', undefined, { refresh_token: tokens.refresh_token, role: 'owner' }, headers)).status, 400);
    const logout = await context.request('/auth/web/logout', undefined, { access_token: tokens.access_token }, headers);
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { status: 'signed_out' });
    assert.equal(context.logoutScope, 'local');
    assert.equal((await context.request('/auth/web/refresh', undefined, { refresh_token: tokens.refresh_token }, headers)).status, 401);
    assert.equal((await context.request('/auth/web/refresh', undefined, { refresh_token: bobTokens.refresh_token }, headers)).status, 200);
    const httpLogin = await context.request('/auth/login', undefined, credentials);
    assert.equal(httpLogin.status, 200);
    assert.equal('refresh_token' in await httpLogin.json(), false);
  } finally { await context.close(); }
});

test('web session renewal and sign-out report provider outages without exposing tokens', { timeout: 20000 }, async () => {
  const context = await fixture();
  const headers = { 'X-Web-Auth-Key': 'test-web-auth-secret-at-least-32-characters' };
  try {
    for (const [endpoint, body] of [
      ['refresh', { refresh_token: 'outage' }], ['logout', { access_token: 'outage' }],
    ] as const) {
      const response = await context.request('/auth/web/' + endpoint, undefined, body, headers);
      assert.equal(response.status, 503);
      assert(!(await response.text()).includes('outage'));
    }
  } finally { await context.close(); }
});

test('expired access tokens must be renewed before the provider confirms local sign-out', { timeout: 20000 }, async () => {
  const context = await fixture();
  const headers = { 'X-Web-Auth-Key': 'test-web-auth-secret-at-least-32-characters' };
  try {
    const login = await context.request('/auth/web/login', undefined,
      { email: 'alice@example.invalid', password: ' fixture password ' }, headers);
    assert.equal(login.status, 200);
    const session = await login.json() as { refresh_token: string };
    const expired = await context.request('/auth/web/logout', undefined, { access_token: 'expired' }, headers);
    assert.equal(expired.status, 401);
    assert.equal(context.logoutScope, null);
    const renewal = await context.request('/auth/web/refresh', undefined, { refresh_token: session.refresh_token }, headers);
    assert.equal(renewal.status, 200);
    const tokens = await renewal.json() as { access_token: string; refresh_token: string };
    const logout = await context.request('/auth/web/logout', undefined, { access_token: tokens.access_token }, headers);
    assert.equal(logout.status, 200);
    assert.equal(context.logoutScope, 'local');
    assert.equal((await context.request('/auth/web/refresh', undefined, { refresh_token: tokens.refresh_token }, headers)).status, 401);
  } finally { await context.close(); }
});

test('web authentication fails closed without its server secret and preserves login account limits', { timeout: 20000 }, async () => {
  const unavailable = await fixture({ WEB_AUTH_SECRET: '' });
  try {
    assert.equal((await unavailable.request('/auth/web/login', undefined, {})).status, 503);
    assert.equal(unavailable.providerCalls, 0);
  } finally { await unavailable.close(); }
  const context = await fixture({ RATE_LIMIT_LOGIN_ACCOUNT_LIMIT: 1 });
  const headers = { 'X-Web-Auth-Key': 'test-web-auth-secret-at-least-32-characters' };
  try {
    const credentials = { email: 'alice@example.invalid', password: 'wrong' };
    assert.equal((await context.request('/auth/web/login', undefined, credentials, headers)).status, 401);
    const blocked = await context.request('/auth/login', undefined, credentials);
    assert.equal(blocked.status, 429);
    assert(Number(blocked.headers.get('Retry-After')) > 0);
    assert.equal(context.providerCalls, 1);
  } finally { await context.close(); }
});
