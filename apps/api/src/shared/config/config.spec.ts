import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnvironment } from './config';

const valid = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://local:local@localhost:55432/wa',
  REDIS_URL: 'redis://localhost:56379',
};

test('rejects invalid protocols, invalid ports, and origins containing paths', () => {
  assert.equal(validateEnvironment(valid).PORT, 3001);
  for (const patch of [
    { DATABASE_URL: 'https://localhost' },
    { DATABASE_URL: 'not-a-url-with-secret' },
    { WEB_ORIGIN: 'not-an-origin' },
    { REDIS_URL: 'postgresql://localhost' },
    { PORT: 70000 },
    { RATE_LIMIT_IP_LIMIT: 0 },
    { SUPABASE_URL: 'https://example.supabase.co' },
    { SUPABASE_URL: 'http://external.invalid', SUPABASE_PUBLISHABLE_KEY: 'test' },
    { WEB_ORIGIN: 'http://localhost:3000/private' },
  ]) assert.throws(() => validateEnvironment({ ...valid, ...patch }));
});

test('configuration errors do not expose credentials', () => {
  assert.throws(
    () => validateEnvironment({ ...valid, DATABASE_URL: 'https://user:secret@localhost' }),
    (error: unknown) => error instanceof Error
      && error.message.includes('DATABASE_URL') && !error.message.includes('secret'),
  );
});

test('HTTP binding and proxy trust require explicit valid network addresses', () => {
  const defaults = validateEnvironment(valid);
  assert.equal(defaults.HTTP_HOST, '127.0.0.1');
  assert.deepEqual(defaults.TRUSTED_PROXIES, []);
  const settings = validateEnvironment({ ...valid, HTTP_HOST: '::', TRUSTED_PROXIES: '10.20.0.5/32, ::1/128, 192.0.2.10' });
  assert.deepEqual(settings.TRUSTED_PROXIES, ['10.20.0.5/32', '::1/128', '192.0.2.10']);
  for (const HTTP_HOST of ['', 'localhost', '0.0.0.0:3001', '256.0.0.1']) {
    assert.throws(() => validateEnvironment({ ...valid, HTTP_HOST }));
  }
  for (const TRUSTED_PROXIES of ['true', 'false', '1', 'loopback', '0.0.0.0/0', '::/0', '10.0.0.1/33', '::1/129', '10.0.0.1/-1', '10.0.0.1/', '127.0.0.1,', 'invalid']) {
    assert.throws(() => validateEnvironment({ ...valid, TRUSTED_PROXIES }));
  }
});
