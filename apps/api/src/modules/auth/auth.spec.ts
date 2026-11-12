import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RateLimitService } from '../../shared/auth/rate-limit.service';
import { SupabaseAuthGateway } from '../../shared/auth/supabase-auth.gateway';

test('Signup validates password, normalizes email, preserves password and never returns credentials', async () => {
  const calls: unknown[][] = [];
  const gateway = { signup: async (...args: unknown[]) => { calls.push(args); } } as unknown as SupabaseAuthGateway;
  const limiter = { consume: async () => 0 } as unknown as RateLimitService;
  const service = new AuthService(limiter, gateway);
  await assert.rejects(service.signup({ email: 'person@example.com', password: 'short' }), BadRequestException);
  assert.deepEqual(await service.signup({ email: ' PERSON@example.com ', password: ' password ' }), { status: 'signup_requested' });
  assert.deepEqual(calls, [['person@example.com', ' password ', undefined]]);
});

test('Signup rate limiting prevents a provider call', async () => {
  const gateway = { signup: async () => { assert.fail('must not call provider'); } } as unknown as SupabaseAuthGateway;
  const limiter = { consume: async () => 10 } as unknown as RateLimitService;
  assert.deepEqual(await new AuthService(limiter, gateway).signup({ email: 'person@example.com', password: 'password123' }), { status: 'limited', retryAfter: 10 });
});
