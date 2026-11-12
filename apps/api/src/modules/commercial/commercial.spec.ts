import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, HttpException } from '@nestjs/common';
import { CommercialService } from './commercial.service';
import { CommercialRepository } from './commercial.repository';
import { RateLimitService } from '../../shared/auth/rate-limit.service';

test('Contact requests reject missing consent, contact details, invalid phone and unexpected fields before storage', async () => {
  let writes = 0;
  const repository = { create: async () => { writes++; } } as unknown as CommercialRepository;
  const limiter = { consume: async () => 0 } as unknown as RateLimitService;
  const service = new CommercialService(repository, limiter);
  for (const input of [{ email: 'a@example.com' }, { consent: true }, { phone: '1234', consent: true }, { email: 'a@example.com', consent: true, status: 'paid' }]) {
    await assert.rejects(service.submit(input), BadRequestException);
  }
  assert.equal(writes, 0);
});

test('Purchase requests bind verified identity and record pending contact only after persistence', async () => {
  const writes: unknown[][] = [];
  const repository = { create: async (...args: unknown[]) => { writes.push(args); } } as unknown as CommercialRepository;
  const limiter = { consume: async () => 0 } as unknown as RateLimitService;
  const service = new CommercialService(repository, limiter);
  const input = { plan: 'full-access', email: '  PERSON@EXAMPLE.COM  ', consent: true };
  const user = { subject: '8a52d077-c7c7-4a19-9886-91ced41a4aa1', email: 'a@example.com' };
  assert.deepEqual(await service.submit(input, user), { status: 'pending_contact' });
  assert.equal(writes[0]?.[1], user.subject);
  assert.equal(writes[0]?.[2], 'full-access');
  assert.equal((writes[0]?.[0] as { email: string }).email, 'person@example.com');
  await assert.rejects(service.submit(input), BadRequestException);
  const unavailable = new CommercialService({ create: async () => { throw new Error('database unavailable'); } } as unknown as CommercialRepository, limiter);
  await assert.rejects(unavailable.submit(input, user), /database unavailable/);
});

test('Contact rate limits prevent writes', async () => {
  const repository = { create: async () => { assert.fail('must not write'); } } as unknown as CommercialRepository;
  const limiter = { consume: async () => 30 } as unknown as RateLimitService;
  await assert.rejects(new CommercialService(repository, limiter).submit({ phone: '+12025550123', consent: true }), HttpException);
});
