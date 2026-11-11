import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Controller, Get, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { configureHttp } from '../src/configure-http';
import { validateEnvironment } from '../src/shared/config/config';

@Controller()
class ClientAddressController {
  @Get('client-address')
  address(@Req() request: { ip: string }) { return { ip: request.ip }; }
}

test('production HTTP settings preserve the trusted boundary of forwarded client addresses', async () => {
  for (const scenario of [
    { proxies: '', expected: '127.0.0.1' },
    { proxies: '192.0.2.10/32', expected: '127.0.0.1' },
    { proxies: '127.0.0.1/32', expected: '198.51.100.20' },
    { proxies: '127.0.0.1/32,198.51.100.20/32', expected: '203.0.113.30' },
  ]) {
    const settings = validateEnvironment({
      NODE_ENV: 'production', WEB_ORIGIN: 'https://merchant.example',
      DATABASE_URL: 'postgresql://localhost/test', REDIS_URL: 'redis://localhost',
      HTTP_HOST: '127.0.0.1', TRUSTED_PROXIES: scenario.proxies,
    });
    const module = await Test.createTestingModule({
      controllers: [ClientAddressController],
      providers: [{ provide: ConfigService, useValue: new ConfigService(settings) }],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    try {
      assert.equal(configureHttp(app), false);
      await app.listen(0, settings.HTTP_HOST);
      const response = await fetch(await app.getUrl() + '/client-address', {
        headers: { 'X-Forwarded-For': '203.0.113.30, 198.51.100.20' },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ip: scenario.expected });
    } finally {
      await app.close();
    }
  }
});
