import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type Session } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Principal } from './auth.types';

@Injectable()
export class SupabaseAuthGateway {
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    if (!url || !key) throw new ServiceUnavailableException('Authentication configuration is pending');
    return { url, key };
  }

  private client() {
    const { url, key } = this.settings();
    // One client per operation: sessions are never shared between users.
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }) },
    });
  }

  private unavailable(status?: number): void {
    if (!status || status === 429 || status >= 500) {
      throw new ServiceUnavailableException('Authentication is temporarily unavailable');
    }
  }

  async verify(token: string): Promise<Principal> {
    const { data, error } = await this.client().auth.getUser(token);
    if (error) {
      this.unavailable(error.status);
      throw new UnauthorizedException('Invalid session');
    }
    if (!data.user || data.user.is_anonymous || !z.uuid().safeParse(data.user.id).success) {
      throw new UnauthorizedException('Invalid session');
    }
    return { subject: data.user.id, email: data.user.email ?? null };
  }

  async login(email: string, password: string, captchaToken?: string) {
    const { data, error } = await this.client().auth.signInWithPassword({
      email, password, options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      this.unavailable(error.status);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!data.session) throw new UnauthorizedException('Invalid email or password');
    return this.session(data.session);
  }

  private session(session: Session) {
    if (!session.refresh_token || session.user.is_anonymous) throw new UnauthorizedException('Invalid session');
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
    };
  }

  async refresh(refreshToken: string) {
    const { url, key } = this.settings();
    // The SDK retries refresh failures for its background-refresh window. Keep
    // this request bounded without leaving a refresh operation running behind it.
    const signal = AbortSignal.timeout(3000);
    let response: Response;
    let data: unknown;
    try {
      response = await fetch(new URL('/auth/v1/token?grant_type=refresh_token', url), {
        method: 'POST', signal,
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      this.unavailable(response.status);
      if (!response.ok) throw new UnauthorizedException('Invalid session');
      data = await response.json();
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Authentication is temporarily unavailable');
    }
    const parsed = z.object({
      access_token: z.string().min(1).max(8192), refresh_token: z.string().min(1).max(8192),
      token_type: z.string().min(1), expires_in: z.number().int().positive(),
      expires_at: z.number().int().positive().optional(),
      user: z.object({ id: z.uuid(), is_anonymous: z.boolean().optional() }),
    }).safeParse(data);
    if (!parsed.success || parsed.data.user.is_anonymous) throw new UnauthorizedException('Invalid session');
    const session = parsed.data;
    return {
      access_token: session.access_token, refresh_token: session.refresh_token,
      token_type: session.token_type, expires_in: session.expires_in,
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    };
  }

  async logout(accessToken: string): Promise<void> {
    const { url, key } = this.settings();
    try {
      const response = await fetch(new URL('/auth/v1/logout?scope=local', url), {
        method: 'POST', signal: AbortSignal.timeout(3000),
        headers: { apikey: key, Authorization: 'Bearer ' + accessToken },
      });
      this.unavailable(response.status);
      if (!response.ok) throw new UnauthorizedException('Invalid session');
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Authentication is temporarily unavailable');
    }
  }

  async requestRecovery(email: string, captchaToken?: string): Promise<void> {
    const origin = this.config.getOrThrow<string>('WEB_ORIGIN');
    const { error } = await this.client().auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/reset-password', origin).href,
      ...(captchaToken ? { captchaToken } : {}),
    });
    // Account-specific rejections receive the same response as accepted mail.
    if (error) this.unavailable(error.status);
  }

  async completeRecovery(tokenHash: string, password: string): Promise<void> {
    const client = this.client();
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) {
      this.unavailable(error.status);
      throw new UnauthorizedException('Invalid or expired recovery link');
    }
    if (!data.session) throw new UnauthorizedException('Invalid or expired recovery link');
    try {
      if (data.session.user.is_anonymous || !z.uuid().safeParse(data.session.user.id).success) {
        throw new UnauthorizedException('Invalid or expired recovery link');
      }
      const result = await client.auth.updateUser({ password });
      if (result.error) {
        this.unavailable(result.error.status);
        throw new BadRequestException('The password could not be updated');
      }
      if (!result.data.user || result.data.user.id !== data.session.user.id) {
        throw new UnauthorizedException('Invalid recovery session');
      }
    } finally {
      // Recovery credentials never reach the browser and cannot renew a session.
      await this.logout(data.session.access_token);
    }
  }
}
