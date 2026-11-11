import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

test('merchant cookies survive reload, renew, isolate businesses and clear on logout', { timeout: 30000 }, async (t) => {
  const key = randomUUID();
  const businesses = new Map();
  const profiles = new Map();
  const current = new Map();
  const sessions = new Map();
  let renewals = 0;
  let logouts = 0;
  let recoveryRequests = 0;
  let recoveryCompletions = 0;
  const recoveryToken = randomUUID();
  let recoveryConsumed = false;
  function issue(email) {
    const access_token = randomUUID();
    const refresh_token = randomUUID();
    sessions.set(refresh_token, email);
    current.set(access_token, email);
    return { access_token, refresh_token, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' };
  }

  const api = createServer(async (req, res) => {
    const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (req.url.startsWith('/auth/web/')) {
      if (req.headers['x-web-auth-key'] !== key) return send(403, {});
      if (req.url === '/auth/web/recover/request') {
        recoveryRequests++;
        if (body.email === 'limited@example.invalid') {
          res.setHeader('Retry-After', '7');
          return send(429, { message: 'private provider details' });
        }
        if (body.email === 'outage@example.invalid') return send(503, { message: 'private provider details' });
        return send(200, { status: 'recovery_requested' });
      }
      if (req.url === '/auth/web/recover/complete') {
        recoveryCompletions++;
        if (body.token_hash !== recoveryToken || recoveryConsumed) return send(401, { message: 'private token details' });
        if (body.password !== 'new fixture password') return send(400, {});
        recoveryConsumed = true;
        return send(200, { status: 'password_updated', access_token: 'must-not-leak', refresh_token: 'must-not-leak' });
      }
      if (req.url.endsWith('/login')) return send(200, issue(body.email));
      if (req.url.endsWith('/refresh')) {
        const email = sessions.get(body.refresh_token);
        if (!email) return send(401, {});
        renewals++;
        sessions.delete(body.refresh_token);
        return send(200, issue(email));
      }
      if (req.url.endsWith('/logout')) {
        if (!current.has(body.access_token)) return send(401, {});
        logouts++;
        return send(200, { status: 'signed_out' });
      }
    }
    const email = current.get(req.headers.authorization?.slice(7));
    if (!email) return send(401, {});
    if (req.url === '/identity/me') {
      if (!profiles.has(email)) profiles.set(email, randomUUID());
      return send(200, { id: profiles.get(email) });
    }
    const owned = businesses.get(email) ?? [];
    if (req.url === '/businesses' && req.method === 'POST') {
      const business = { id: randomUUID(), name: body.name, role: 'owner' };
      businesses.set(email, [...owned, business]);
      return send(201, business);
    }
    if (req.url === '/businesses') return send(200, owned);
    const business = owned.find((row) => req.url === '/businesses/' + row.id);
    return send(business ? 200 : 404, business ?? {});
  });
  const apiPort = await listen(api);
  t.after(() => { api.closeAllConnections(); return new Promise((done) => api.close(done)); });
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((done) => reservation.close(done));
  const origin = 'http://127.0.0.1:' + port;
  const web = spawn(process.execPath, ['.next/standalone/apps/web/server.js'], {
    env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port),
      API_INTERNAL_URL: 'http://127.0.0.1:' + apiPort, WEB_AUTH_SECRET: key, WEB_ORIGIN: origin },
    stdio: 'inherit',
  });
  t.after(async () => {
    if (web.exitCode === null && web.signalCode === null) {
      const exit = once(web, 'exit');
      web.kill();
      await exit;
    }
  });
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Server is starting. */ }
    assert(i < 50, 'web did not become ready');
    await delay(100);
  }

  function browser() {
    const jar = new Map();
    return async (path, body, source = origin) => {
      const response = await fetch(origin + '/api/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Origin: source, 'Content-Type': 'application/json', Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const at = pair.indexOf('=');
        const name = pair.slice(0, at);
        if (pair.slice(at + 1) && !/Max-Age=0/i.test(cookie)) {
          assert.match(cookie, /HttpOnly/i);
          assert.match(cookie, /Secure/i);
          jar.set(name, pair.slice(at + 1));
        } else jar.delete(name);
      }
      return response;
    };
  }
  const alice = browser(), bob = browser();
  assert.equal((await alice('session')).status, 401);
  for (const [client, email] of [[alice, 'alice@example.invalid'], [bob, 'bob@example.invalid']]) {
    const login = await client('session/login', { email, password: 'fixture password' });
    assert(login.ok, 'login status ' + login.status);
    assert.doesNotMatch(await login.text(), /access_token|refresh_token/);
    const identity = await client('session');
    assert.equal(identity.status, 200);
    assert.equal((await identity.json()).id, profiles.get(email));
    assert.equal(identity.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await (await client('businesses')).json(), []);
  }
  assert.equal((await alice('businesses', { name: 'Unexpected' }, 'https://unrelated.invalid')).status, 403);
  const created = await alice('businesses', { name: 'Pilot shop' });
  assert(created.ok);
  const { id } = await created.json();
  current.clear();
  assert.equal((await (await alice('businesses/' + id)).json()).name, 'Pilot shop');
  assert.equal(renewals, 1);
  assert.equal((await bob('businesses/' + id)).status, 404);
  assert.deepEqual(await (await bob('businesses')).json(), []);
  current.clear();
  assert((await alice('session/logout', {})).ok);
  assert.equal(renewals, 3);
  assert.equal(logouts, 1);
  assert.equal((await alice('businesses')).status, 401);

  const recovering = browser();
  assert((await recovering('session/login', { email: 'recovering@example.invalid', password: 'fixture password' })).ok);
  for (const action of ['request', 'complete']) {
    const rejected = await recovering('session/recovery/' + action, {}, 'https://unrelated.invalid');
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.getSetCookie().length, 0);
  }
  assert.equal(recoveryRequests, 0);
  assert.equal(recoveryCompletions, 0);
  const known = await recovering('session/recovery/request', { email: 'recovering@example.invalid' });
  const unknown = await recovering('session/recovery/request', { email: 'unknown@example.invalid' });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await known.json(), await unknown.json());
  const limited = await recovering('session/recovery/request', { email: 'limited@example.invalid' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '7');
  assert.doesNotMatch(await limited.text(), /private provider details/);
  const unavailable = await recovering('session/recovery/request', { email: 'outage@example.invalid' });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private provider details/);
  const invalid = await recovering('session/recovery/complete', { token_hash: 'invalid', password: 'new fixture password' });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.headers.getSetCookie().length, 0);
  assert.equal((await recovering('businesses')).status, 200);
  const completed = await recovering('session/recovery/complete', { token_hash: recoveryToken, password: 'new fixture password' });
  assert.equal(completed.status, 200);
  assert.equal(completed.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await completed.json(), { status: 'password_updated', authenticated: false });
  assert.equal(completed.headers.getSetCookie().length, 2);
  assert(completed.headers.getSetCookie().every((cookie) => /Max-Age=0/i.test(cookie)));
  assert.equal((await recovering('businesses')).status, 401);
  const replay = await recovering('session/recovery/complete', { token_hash: recoveryToken, password: 'new fixture password' });
  assert.equal(replay.status, 401);
});
