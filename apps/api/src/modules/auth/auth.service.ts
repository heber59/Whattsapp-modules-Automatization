import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RateLimitService } from '../../shared/auth/rate-limit.service';
import { SupabaseAuthGateway } from '../../shared/auth/supabase-auth.gateway';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
  captchaToken: z.string().min(1).max(4096).optional(),
}).strict();

@Injectable()
export class AuthService {
  constructor(private readonly limiter: RateLimitService, private readonly gateway: SupabaseAuthGateway) {}

  async login(input: unknown) {
    const parsed = credentials.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Valid email and password are required');
    const { email, password, captchaToken } = parsed.data;
    const retryAfter = await this.limiter.consume('account', email);
    if (retryAfter) return { status: 'limited' as const, retryAfter };
    const session = await this.gateway.login(email, password, captchaToken);
    return { status: 'authenticated' as const, session };
  }
}
