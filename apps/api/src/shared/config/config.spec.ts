import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnvironment } from './config';

const valid = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://local:local@localhost:55432/wa',
  REDIS_URL: 'redis://localhost:56379',
};

test('rechaza protocolos incorrectos, puertos inválidos y orígenes con ruta', () => {
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

test('los errores de configuración no revelan credenciales', () => {
  assert.throws(
    () => validateEnvironment({ ...valid, DATABASE_URL: 'https://user:secret@localhost' }),
    (error: unknown) => error instanceof Error
      && error.message.includes('DATABASE_URL') && !error.message.includes('secret'),
  );
});
