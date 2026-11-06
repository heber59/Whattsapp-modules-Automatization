import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './access.guard';
import { RateLimitService } from './rate-limit.service';
import { SupabaseAuthGateway } from './supabase-auth.gateway';

@Module({
  providers: [RateLimitService, SupabaseAuthGateway, { provide: APP_GUARD, useClass: AccessGuard }],
  exports: [RateLimitService, SupabaseAuthGateway],
})
export class AccessModule {}
