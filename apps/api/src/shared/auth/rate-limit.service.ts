import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

const TOKEN_BUCKET = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000
local state = redis.call('HMGET', KEYS[1], 'tokens', 'updated')
local capacity = tonumber(ARGV[1])
local period = tonumber(ARGV[2])
local tokens = tonumber(state[1]) or capacity
local updated = tonumber(state[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated) * capacity / period)
local allowed = 0
local retry = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry = math.ceil((1 - tokens) * period / capacity)
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(period * 2))
return {allowed, retry}
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      connectTimeout: 3000, commandTimeout: 3000, maxRetriesPerRequest: 1,
    });
    this.redis.on('error', () => {});
  }

  async consume(scope: 'ip' | 'user' | 'account', identity: string): Promise<number> {
    const key = this.config.getOrThrow<string>('RATE_LIMIT_PREFIX') + ':' + scope + ':'
      + createHash('sha256').update(identity).digest('hex');
    const setting = { ip: 'RATE_LIMIT_IP_LIMIT', user: 'RATE_LIMIT_USER_LIMIT', account: 'RATE_LIMIT_LOGIN_ACCOUNT_LIMIT' }[scope];
    const capacity = this.config.getOrThrow<number>(setting);
    try {
      const result = await this.redis.eval(TOKEN_BUCKET, 1, key, capacity,
        this.config.getOrThrow<number>('RATE_LIMIT_WINDOW_MS')) as [number, number];
      return result[0] === 1 ? 0 : Math.max(1, Math.ceil(result[1] / 1000));
    } catch {
      throw new ServiceUnavailableException('Access control is temporarily unavailable');
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
