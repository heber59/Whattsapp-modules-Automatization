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

  async login(input: unknown, includeRefreshToken = false) {
    const parsed = credentials.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Valid email and password are required');
    const { email, password, captchaToken } = parsed.data;
    const retryAfter = await this.limiter.consume('account', email);
    if (retryAfter) return { status: 'limited' as const, retryAfter };
    const tokens = await this.gateway.login(email, password, captchaToken);
    const session = includeRefreshToken ? tokens : {
      access_token: tokens.access_token, token_type: tokens.token_type,
      expires_in: tokens.expires_in, expires_at: tokens.expires_at,
    };
    return { status: 'authenticated' as const, session };
  }

  refresh(input: unknown) {
    const parsed = z.object({ refresh_token: z.string().min(1).max(8192) }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException('A refresh token is required');
    return this.gateway.refresh(parsed.data.refresh_token);
  }

  async logout(input: unknown) {
    const parsed = z.object({ access_token: z.string().min(1).max(8192) }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException('An access token is required');
    await this.gateway.logout(parsed.data.access_token);
    return { status: 'signed_out' };
  }

  async requestRecovery(input: unknown) {
    const parsed = credentials.omit({ password: true }).safeParse(input);
    if (!parsed.success) throw new BadRequestException('A valid email is required');
    const { email, captchaToken } = parsed.data;
    const retryAfter = await this.limiter.consume('account', 'recovery:' + email);
    if (retryAfter) return { status: 'limited' as const, retryAfter };
    await this.gateway.requestRecovery(email, captchaToken);
    return { status: 'recovery_requested' as const };
  }

  async completeRecovery(input: unknown) {
    const parsed = z.object({
      token_hash: z.string().min(1).max(8192), password: z.string().min(8).max(1024),
    }).strict().safeParse(input);
    if (!parsed.success) throw new BadRequestException('A recovery token and a password of 8 to 1024 characters are required');
    await this.gateway.completeRecovery(parsed.data.token_hash, parsed.data.password);
    return { status: 'password_updated' };
  }
}
